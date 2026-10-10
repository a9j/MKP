/**
 * Visitor tracking and the traffic summary. The numbers on /admin/traffic are
 * only useful if bots stay out, sources are named the way a person would name
 * them, and a visit's time adds up across its pages.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanPath,
  deviceFrom,
  formatDuration,
  isBot,
  isUuid,
  referrerHost,
  sourceLabel,
} from "../src/lib/tracking";
import { summarize, rangeFor, type PageViewRow } from "../src/lib/traffic";
import { breadcrumbLd, plainText } from "../src/lib/seo";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

test("bots and empty user agents are not counted", () => {
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(isBot("facebookexternalhit/1.1"), true);
  assert.equal(isBot("Mozilla/5.0 HeadlessChrome/130.0"), true);
  assert.equal(isBot(""), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot(IPHONE), false);
  assert.equal(isBot(MAC), false);
});

test("device comes from the user agent, then the viewport", () => {
  assert.equal(deviceFrom(IPHONE), "mobile");
  assert.equal(deviceFrom(MAC), "desktop");
  assert.equal(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(deviceFrom(MAC, 400), "mobile");
});

test("referrers keep the host only, and our own site is not a referrer", () => {
  assert.equal(referrerHost("https://www.google.com/search?q=toledo+teacher+pay", "monakproject.org"), "google.com");
  assert.equal(referrerHost("https://monakproject.org/reports", "monakproject.org"), null);
  assert.equal(referrerHost("https://www.monakproject.org/", "monakproject.org"), null);
  assert.equal(referrerHost("", "monakproject.org"), null);
  assert.equal(referrerHost("not a url", "monakproject.org"), null);
});

test("paths drop the query string and refuse admin and api", () => {
  assert.equal(cleanPath("/explorer?utm_source=fb"), "/explorer");
  assert.equal(cleanPath("/admin/traffic"), null);
  assert.equal(cleanPath("/api/track"), null);
  assert.equal(cleanPath("https://evil.example/"), null);
  assert.equal(cleanPath(42), null);
});

test("sources read like names", () => {
  assert.equal(sourceLabel({ utm_source: null, referrer_host: "google.com" }), "Google");
  assert.equal(sourceLabel({ utm_source: null, referrer_host: "l.facebook.com" }), "Facebook");
  assert.equal(sourceLabel({ utm_source: null, referrer_host: "t.co" }), "X (Twitter)");
  assert.equal(sourceLabel({ utm_source: "newsletter", referrer_host: "google.com" }), "newsletter");
  assert.equal(sourceLabel({ utm_source: null, referrer_host: null }), "Direct or unknown");
  assert.equal(sourceLabel({ utm_source: null, referrer_host: "toledoblade.com" }), "toledoblade.com");
});

test("durations", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(187), "3m 07s");
  assert.equal(formatDuration(3720), "1h 02m");
});

test("uuid check", () => {
  assert.equal(isUuid("3f1c2b8e-1d4a-4c3e-9b1a-2f6e7d8c9a0b"), true);
  assert.equal(isUuid("nope"), false);
  assert.equal(isUuid(undefined), false);
});

function row(over: Partial<PageViewRow>): PageViewRow {
  return {
    id: crypto.randomUUID(),
    visit_id: "v1",
    visitor_hash: "h1",
    path: "/",
    referrer_host: null,
    utm_source: null,
    utm_campaign: null,
    device: "mobile",
    city: "Toledo",
    region: "OH",
    country: "US",
    started_at: "2026-10-07T14:00:00Z",
    last_seen_at: "2026-10-07T14:00:30Z",
    engaged_seconds: 30,
    ...over,
  };
}

test("a visit adds up its pages and keeps its landing page and source", () => {
  const rows = [
    row({ visit_id: "v1", path: "/", referrer_host: "google.com", started_at: "2026-10-07T14:00:00Z", engaged_seconds: 20 }),
    row({ visit_id: "v1", path: "/explorer", started_at: "2026-10-07T14:00:20Z", engaged_seconds: 100 }),
    row({ visit_id: "v2", visitor_hash: "h2", path: "/budget", device: "desktop", city: null, region: null, country: "US", started_at: "2026-10-07T15:00:00Z", engaged_seconds: 4 }),
  ];
  const s = summarize(rows, new Date("2026-10-07T20:00:00Z"));

  assert.equal(s.visitors, 2);
  assert.equal(s.visits, 2);
  assert.equal(s.pageViews, 3);
  assert.equal(s.avgVisitSeconds, (20 + 100 + 4) / 2);
  assert.equal(s.pagesPerVisit, 1.5);
  // v2 saw one page for four seconds.
  assert.equal(s.quickExitShare, 0.5);
  assert.equal(s.onlineNow, 0);

  const v1 = s.recentVisits.find((v) => v.visitId === "v1")!;
  assert.equal(v1.landingPage, "/");
  assert.deepEqual(v1.pages, ["/", "/explorer"]);
  assert.equal(v1.seconds, 120);
  assert.equal(v1.source, "Google");
  assert.equal(v1.place, "Toledo, OH");

  assert.equal(s.recentVisits[0].visitId, "v2", "newest visit first");
  assert.deepEqual(
    s.sources.map((r) => r.label).sort(),
    ["Direct or unknown", "Google"],
  );
  assert.equal(s.pages.find((p) => p.path === "/explorer")?.avgSeconds, 100);
});

test("someone still reading counts as on the site now", () => {
  const s = summarize([row({ last_seen_at: "2026-10-07T19:58:00Z" })], new Date("2026-10-07T20:00:00Z"));
  assert.equal(s.onlineNow, 1);
});

test("days are grouped in Toledo's time zone", () => {
  // 02:00 UTC on the 8th is still the evening of the 7th in Toledo.
  const s = summarize([row({ started_at: "2026-10-08T02:00:00Z" })]);
  assert.equal(s.days[0].day, "2026-10-07");
});

test("an empty window is all zeros, not NaN", () => {
  const s = summarize([]);
  assert.equal(s.avgVisitSeconds, 0);
  assert.equal(s.pagesPerVisit, 0);
  assert.equal(s.quickExitShare, 0);
});

test("an unknown range falls back to seven days", () => {
  assert.equal(rangeFor(undefined).key, "7d");
  assert.equal(rangeFor("30d").key, "30d");
  assert.equal(rangeFor("forever").key, "7d");
});

test("report descriptions are plain text cut at a word", () => {
  const md = "## The levy\n\nToledo Public Schools is asking for a **renewal** of a [5-year levy](https://example.com). It raises about $20 million a year for day-to-day operating costs across the district.";
  const out = plainText(md, 80);
  assert.ok(out.length <= 80);
  assert.ok(!/[#*\[\]]/.test(out));
  assert.ok(out.includes("5-year levy"), "hyphens survive");
  assert.ok(out.endsWith("…"));
});

test("breadcrumbs start at home and use absolute URLs", () => {
  const ld = breadcrumbLd("https://monakproject.org", [{ name: "Reports", path: "/reports" }]) as {
    itemListElement: { position: number; item: string }[];
  };
  assert.equal(ld.itemListElement[0].item, "https://monakproject.org/");
  assert.equal(ld.itemListElement[1].item, "https://monakproject.org/reports");
  assert.equal(ld.itemListElement[1].position, 2);
});
