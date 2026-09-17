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
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { getVotes, getMemberTallies } from "../src/lib/queries/votes";

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
  // Values themselves are editable from /admin/settings, so this asserts the
  // rule rather than a particular string: a filled key is present, an empty
  // one is absent so the page can fall back to its bracket placeholder.
  assert.ok(settings.org_ein && settings.org_ein.length > 0, "a filled setting was dropped");
  assert.equal(settings.contact_email, "hello@monakproject.org");
  assert.equal(settings.donate_url, undefined, "an empty setting was returned");
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

test("the anonymous key cannot write to the explorer tables", async () => {
  // The admin upload actions check for an administrator, and RLS is the second
  // layer behind them: even a request that got past the UI writes nothing.
  const supabase = createPublicClient();

  const salary = await supabase.from("salary_schedule").insert({
    school_year: "2099-2100", district: "Nowhere", lane: "BA", step: 1,
    salary: 1, source_url: "https://example.com/a.pdf",
  });
  assert.ok(salary.error, "an anonymous write to salary_schedule succeeded");

  const budget = await supabase.from("budget_categories").insert({
    fiscal_year: "2099", category: "Nowhere", amount: 1,
    source_url: "https://example.com/a.pdf",
  });
  assert.ok(budget.error, "an anonymous write to budget_categories succeeded");

  const cpi = await supabase.from("cpi").insert({
    year: 2099, index_value: 1, source_url: "https://example.com/a.pdf",
  });
  assert.ok(cpi.error, "an anonymous write to cpi succeeded");
});

test("the anonymous key cannot write", async () => {
  const supabase = createPublicClient();
  const { error } = await supabase
    .from("corrections")
    .insert({ correction_date: "2026-01-01", page_path: "/", what_changed: "x", why: "y" });
  assert.ok(error, "an anonymous write to corrections succeeded");
});

// ---------------------------------------------------------------------------
// Software collects and drafts. A person publishes.
// ---------------------------------------------------------------------------

test("a machine written draft never reaches a public read", async () => {
  const votes = await getVotes();
  const titles = votes.map((v) => v.itemTitle);
  assert.ok(
    !titles.includes("Renew transportation services agreement"),
    "an AI draft was returned by the public votes query",
  );

  // Not merely filtered in the query: the anonymous key cannot see the row.
  const anon = createPublicClient();
  const { data } = await anon.from("votes").select("id, item_title, status, ai_draft");
  assert.ok((data ?? []).length > 0, "expected the seed to have published votes");
  assert.ok(
    (data ?? []).every((row) => row.status === "published" && row.ai_draft === false),
    "a draft row was readable with the anonymous key",
  );

  const feed = await getLatestFeed(50);
  assert.ok(
    !feed.some((e) => e.title === "Renew transportation services agreement"),
    "an AI draft reached the Latest feed",
  );
});

/**
 * The service role client, built here rather than imported.
 *
 * src/lib/supabase/service.ts carries the "server-only" guard, which throws
 * outside a server component and would fail this file at import time. The key
 * and the URL are the same, so the boundary being tested is the real one.
 */
function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

test("the service role may draft and may not publish", async () => {
  const service = serviceClient();

  const { data: meeting } = await service.from("meetings").select("id").limit(1).single();
  assert.ok(meeting, "expected a seeded meeting");

  // Drafting is allowed: this is what a collector does.
  const { data: draft, error: draftError } = await service
    .from("votes")
    .insert({
      meeting_id: meeting.id,
      item_title: "Service role draft",
      summary: "Written by the test, never published.",
      category: "other",
      status: "draft",
      ai_draft: true,
      ai_model: "test-model",
      ai_confidence: 0.5,
    })
    .select("id")
    .single();
  assert.equal(draftError, null, `the service role could not write a draft: ${draftError?.message}`);

  // Publishing is not, on insert or on update.
  const { error: insertPublished } = await service.from("votes").insert({
    meeting_id: meeting.id,
    item_title: "Service role published",
    summary: "Should never exist.",
    category: "other",
    status: "published",
    published_at: new Date().toISOString(),
  });
  assert.ok(insertPublished, "the service role inserted a published vote");

  const { error: updatePublished } = await service
    .from("votes")
    .update({ status: "published", published_at: new Date().toISOString(), ai_draft: false })
    .eq("id", draft!.id);
  assert.ok(updatePublished, "the service role published an existing draft");

  const { error: publishedReport } = await service.from("reports").insert({
    slug: `service-role-${Date.now()}`,
    title: "Should never exist",
    type: "pay_report",
    report_date: "2026-01-01",
    summary: "x",
    status: "published",
    published_at: new Date().toISOString(),
  });
  assert.ok(publishedReport, "the service role published a report");

  await service.from("votes").delete().eq("id", draft!.id);
});

test("the voting record counts published votes only", async () => {
  const tallies = await getMemberTallies();
  const votes = await getVotes();
  const published = new Map<string, number>();
  for (const vote of votes) {
    for (const member of vote.members) {
      published.set(member.personId, (published.get(member.personId) ?? 0) + 1);
    }
  }
  for (const tally of tallies) {
    assert.equal(
      tally.votesCast,
      published.get(tally.personId) ?? 0,
      `${tally.name} shows ${tally.votesCast} votes cast but appears on ${published.get(tally.personId) ?? 0} published votes`,
    );
  }
});
