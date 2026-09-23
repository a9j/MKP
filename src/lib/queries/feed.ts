import { createPublicClient } from "@/lib/supabase/public";
import { bodyVoteKind } from "@/lib/bodies";

export type FeedKind = "report" | "records_request" | "vote" | "listening";

export type FeedEntry = {
  kind: FeedKind;
  kindLabel: string;
  title: string;
  subtitle: string;
  date: string;
  dateLabel: string;
  href: string;
  action: string;
};

/** Section names as the copy doc and the mockup write them. */
const KIND_LABEL: Record<FeedKind, string> = {
  report: "Report",
  records_request: "Records Desk",
  vote: "Vote Watch",
  listening: "Listening",
};

/** What the row invites you to do, matching the mockup's right hand column. */
const KIND_ACTION: Record<FeedKind, string> = {
  report: "Read",
  records_request: "Open",
  vote: "Read",
  listening: "Read",
};

function isFeedKind(value: string): value is FeedKind {
  return value in KIND_LABEL;
}

/** "2026-09-12" becomes "Sep 12, 2026". */
export function formatFeedDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  // Built from parts rather than new Date(iso), which would shift the day for
  // anyone west of UTC and show a vote as happening the day before.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The most recent published items across reports, records requests, votes and
 * listening summaries. Drafts are excluded by the view and again by RLS.
 */
export async function getLatestFeed(limit = 6): Promise<FeedEntry[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("latest_feed")
    .select("kind, title, subtitle, date, href, body_slug")
    .order("date", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not load the latest feed: ${error.message}`);
  }

  const entries: FeedEntry[] = [];
  for (const row of data ?? []) {
    // Every column of the view is nullable to Postgres because it is a union,
    // so a row missing what it takes to render is skipped rather than shown
    // half built.
    if (!row.kind || !row.title || !row.date || !row.href) continue;
    if (!isFeedKind(row.kind)) continue;

    entries.push({
      kind: row.kind,
      // A vote says which body took it. Now that more than one body is
      // covered, "Vote Watch" alone no longer tells a reader what they are
      // looking at. The subtitle holds the body's full name.
      kindLabel:
        row.kind === "vote"
          ? bodyVoteKind(row.body_slug, row.subtitle ?? "Vote Watch")
          : KIND_LABEL[row.kind],
      title: row.title,
      subtitle: row.subtitle ?? "",
      date: row.date,
      dateLabel: formatFeedDate(row.date),
      href: row.href,
      action: KIND_ACTION[row.kind],
    });
  }
  return entries;
}
