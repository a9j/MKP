/**
 * How the review queue is shaped: what sorts first, and how the digest groups
 * it. Kept apart from the query so the rules can be tested directly, the way
 * email-template.ts is kept apart from the module holding the Resend key.
 */
import { compareBodies } from "@/lib/bodies";

export type ReviewKind = "vote" | "report" | "listening" | "records";

export type ReviewItem = {
  key: string;
  /** Path into the admin form for this item, deep enough to act on it. */
  href: string;
  title: string;
  /** What kind of thing it is, as a person would say it. */
  kind: string;
  reviewKind: ReviewKind;
  /** The body it belongs to, where it belongs to one. */
  bodySlug: string | null;
  bodyLabel: string;
  /** What it is sorted by inside its group: newest first. */
  sortDate: string;
  aiDraft: boolean;
  /** One line of context under the title. */
  detail: string;
};


/**
 * What the dashboard shows first.
 *
 * Machine written drafts sort to the top, because they are the only items on
 * the list that nobody has read.
 */
export function unreadFirst(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((a, b) => Number(b.aiDraft) - Number(a.aiDraft));
}

const KIND_ORDER: ReviewKind[] = ["vote", "report", "listening", "records"];

/**
 * The digest's order: by body, then by type, then newest first.
 *
 * Grouping by body is what lets a reader skim for the one they care about.
 * Items that belong to no body sit under the organization's own name rather
 * than under a blank heading.
 */
export function groupForDigest(
  items: ReviewItem[],
): { label: string; slug: string | null; items: ReviewItem[] }[] {
  const groups = new Map<string, { label: string; slug: string | null; items: ReviewItem[] }>();

  for (const item of items) {
    const key = item.bodySlug ?? item.bodyLabel;
    const group = groups.get(key);
    if (group) group.items.push(item);
    else groups.set(key, { label: item.bodyLabel, slug: item.bodySlug, items: [item] });
  }

  for (const group of groups.values()) {
    group.items.sort(
      (a, b) =>
        KIND_ORDER.indexOf(a.reviewKind) - KIND_ORDER.indexOf(b.reviewKind) ||
        b.sortDate.localeCompare(a.sortDate),
    );
  }

  // Bodies in the site's usual order, then everything that has no body.
  return [...groups.values()].sort((a, b) => {
    if (a.slug && b.slug) return compareBodies(a.slug, b.slug);
    if (a.slug) return -1;
    if (b.slug) return 1;
    return a.label.localeCompare(b.label);
  });
}
