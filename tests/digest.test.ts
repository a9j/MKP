/**
 * The daily digest's rules, against the local stack.
 *
 * What matters here is what it says and in what order, and the one case it is
 * most important to get right: a day with nothing waiting sends nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupForDigest, unreadFirst, type ReviewItem } from "../src/lib/review-queue";
import { renderEmail } from "../src/lib/email-template";
import {
  automationBodies,
  automationEnabled,
  cronRequestAuthorised,
} from "../src/lib/automation";

function item(over: Partial<ReviewItem>): ReviewItem {
  return {
    key: "k",
    href: "/admin/votes/1",
    title: "A thing",
    kind: "Vote",
    reviewKind: "vote",
    bodySlug: null,
    bodyLabel: "The Mona K Project",
    sortDate: "2026-01-01",
    aiDraft: false,
    detail: "Vote",
    ...over,
  };
}

test("machine written drafts sort to the top of the dashboard", () => {
  const sorted = unreadFirst([
    item({ key: "a", aiDraft: false }),
    item({ key: "b", aiDraft: true }),
  ]);
  assert.deepEqual(
    sorted.map((i) => i.key),
    ["b", "a"],
  );
});

test("the digest groups by body, then by type, then newest first", () => {
  const groups = groupForDigest([
    item({ key: "report", reviewKind: "report", sortDate: "2026-02-01" }),
    item({ key: "council-old", bodySlug: "toledo-city-council", bodyLabel: "City Council", sortDate: "2026-01-01" }),
    item({ key: "tps", bodySlug: "tps-board", bodyLabel: "TPS Board", sortDate: "2026-01-01" }),
    item({ key: "council-new", bodySlug: "toledo-city-council", bodyLabel: "City Council", sortDate: "2026-03-01" }),
  ]);

  // Bodies in the site's order, then the items that belong to no body.
  assert.deepEqual(
    groups.map((g) => g.label),
    ["TPS Board", "City Council", "The Mona K Project"],
  );

  // Newest first inside a body.
  const council = groups.find((g) => g.label === "City Council")!;
  assert.deepEqual(
    council.items.map((i) => i.key),
    ["council-new", "council-old"],
  );
});

test("the digest mail carries the links, the count and the footer", () => {
  const groups = [
    {
      heading: "City Council",
      items: [
        { label: "O-625-26 street resurfacing", detail: "Vote. AI draft, unreviewed", url: "https://example.org/admin/votes/7" },
      ],
    },
  ];
  const { html, text } = renderEmail({
    title: "[1] item waiting on you",
    body: ["One thing is waiting for you to read it."],
    groups,
    footer: "Nothing publishes until you approve it.",
  });

  for (const output of [html, text]) {
    assert.match(output, /\[1\] item waiting on you/);
    assert.match(output, /City Council/);
    assert.match(output, /O-625-26 street resurfacing/);
    assert.match(output, /https:\/\/example\.org\/admin\/votes\/7/);
    assert.match(output, /Nothing publishes until you approve it\./);
  }

  // The house style: navy heading, gold rule, and a font stack that falls back
  // to the system sans where Instrument Sans is not available.
  assert.match(html, /#0F2A44/);
  assert.match(html, /#D9A441/);
  assert.match(html, /Instrument Sans/);
});

test("a cron route refuses a caller without the secret", () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "a-shared-secret";

  const withHeader = (value?: string) =>
    new Request("https://example.org/api/cron/digest", {
      headers: value ? { authorization: value } : {},
    });

  assert.equal(cronRequestAuthorised(withHeader("Bearer a-shared-secret")), true);
  assert.equal(cronRequestAuthorised(withHeader("Bearer wrong-secret-xx")), false);
  assert.equal(cronRequestAuthorised(withHeader()), false);

  // No secret configured refuses everyone, rather than leaving the route open.
  process.env.CRON_SECRET = "";
  assert.equal(cronRequestAuthorised(withHeader("Bearer a-shared-secret")), false);

  process.env.CRON_SECRET = previous;
});

test("automation is off unless it is explicitly on, and only for named bodies", () => {
  const previousEnabled = process.env.AUTOMATION_ENABLED;
  const previousBodies = process.env.AUTOMATION_BODIES;

  for (const value of ["", "false", "1", "yes", "TRUE "]) {
    process.env.AUTOMATION_ENABLED = value;
    assert.equal(automationEnabled(), value.trim().toLowerCase() === "true", `for "${value}"`);
  }

  delete process.env.AUTOMATION_BODIES;
  assert.deepEqual(automationBodies(), ["tps"], "defaults to the school board alone");

  process.env.AUTOMATION_BODIES = "tps, council";
  assert.deepEqual(automationBodies(), ["tps", "council"]);

  // An unrecognised name is dropped rather than guessed at.
  process.env.AUTOMATION_BODIES = "council, senate";
  assert.deepEqual(automationBodies(), ["council"]);

  process.env.AUTOMATION_ENABLED = previousEnabled;
  process.env.AUTOMATION_BODIES = previousBodies;
});
