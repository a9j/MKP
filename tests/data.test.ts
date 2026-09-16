/**
 * Exercises the data layer against the local Postgres and PostgREST stack from
 * scripts/local-supabase.sh, so the queries, the generated types, and the RLS
 * policies are all tested together rather than mocked.
 *
 *   bash scripts/local-supabase.sh
 *   node scripts/supabase-gateway.mjs &
 *   pnpm test:data
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getLatestFeed, formatFeedDate } from "../src/lib/queries/feed";
import { getSiteSettings } from "../src/lib/queries/settings";
import { createPublicClient } from "../src/lib/supabase/public";

test("latest feed returns newest first", async () => {
  const feed = await getLatestFeed(6);
  assert.ok(feed.length > 0, "expected the development seed to produce feed rows");
  const dates = feed.map((e) => e.date);
  const sorted = [...dates].sort().reverse();
  assert.deepEqual(dates, sorted, "feed is not ordered by date descending");
});

test("latest feed honours the limit", async () => {
  const feed = await getLatestFeed(3);
  assert.equal(feed.length, 3);
});

test("latest feed hides drafts", async () => {
  const feed = await getLatestFeed(50);
  const titles = feed.map((e) => e.title);
  assert.ok(!titles.includes("Draft levy explainer"), "a draft report reached the public feed");
  assert.ok(
    !titles.some((t) => t.includes("Parents")),
    "a draft listening session reached the public feed",
  );
});

test("latest feed covers all four sources", async () => {
  const feed = await getLatestFeed(50);
  const kinds = new Set(feed.map((e) => e.kind));
  for (const kind of ["report", "records_request", "vote", "listening"]) {
    assert.ok(kinds.has(kind as never), `feed is missing ${kind} rows`);
  }
});

test("every feed row is renderable", async () => {
  for (const entry of await getLatestFeed(50)) {
    assert.ok(entry.title.length > 0, "empty title");
    assert.ok(entry.href.startsWith("/"), `bad href ${entry.href}`);
    assert.ok(entry.kindLabel.length > 0, "missing kind label");
    assert.ok(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(entry.dateLabel), `bad date ${entry.dateLabel}`);
  }
});

test("feed dates do not shift across time zones", () => {
  // Rendering a UTC date through a local Date would show Sep 11 west of UTC.
  const previous = process.env.TZ;
  process.env.TZ = "America/New_York";
  assert.equal(formatFeedDate("2026-09-12"), "Sep 12, 2026");
  process.env.TZ = "Pacific/Auckland";
  assert.equal(formatFeedDate("2026-01-01"), "Jan 1, 2026");
  process.env.TZ = previous;
});

test("site settings expose filled values and omit empty ones", async () => {
  const settings = await getSiteSettings();
  assert.equal(settings.org_ein, "48-1234567");
  assert.equal(settings.contact_email, "hello@monakproject.org");
  // Seeded empty, so it is absent and the page falls back to the placeholder.
  assert.equal(settings.donate_url, undefined);
});

test("the anonymous key never sees an operational setting", async () => {
  const settings = await getSiteSettings();
  assert.equal(settings.resend_audience_id, undefined);
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_settings").select("key");
  const keys = (data ?? []).map((r) => r.key);
  assert.ok(!keys.includes("resend_audience_id"), "a private setting was readable anonymously");
});

test("the anonymous key is refused on the private tables", async () => {
  const supabase = createPublicClient();

  // Called one at a time rather than in a loop: a union of table names widens
  // the result type and loses the per table row shape.
  const admins = await supabase.from("admins").select("id");
  assert.ok(admins.error, "admins was readable with the anonymous key");
  assert.equal(admins.data, null);

  const inquiries = await supabase.from("inquiries").select("id");
  assert.ok(inquiries.error, "inquiries was readable with the anonymous key");
  assert.equal(inquiries.data, null);

  const subscribers = await supabase.from("subscribers").select("id");
  assert.ok(subscribers.error, "subscribers was readable with the anonymous key");
  assert.equal(subscribers.data, null);
});

test("the anonymous key cannot write", async () => {
  const supabase = createPublicClient();
  const { error } = await supabase
    .from("corrections")
    .insert({ correction_date: "2026-01-01", page_path: "/", what_changed: "x", why: "y" });
  assert.ok(error, "an anonymous write to corrections succeeded");
});
