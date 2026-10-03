/**
 * The bodies Vote Watch covers, and the short names the site calls them.
 *
 * `bodies.name` is the legal name and stays that way on the record. A filter
 * bar and a feed label need something shorter, and "Lucas County Commissioners
 * vote" does not fit a phone. The map is keyed by slug so a renamed body does
 * not silently lose its short name, and anything not listed falls back to the
 * name the database holds.
 *
 * The order here is the order the filter and the member table use: schools
 * first, because that is what the organization started on.
 */
export const BODY_ORDER = ["tps-board", "toledo-city-council", "lucas-county-commissioners"] as const;

const SHORT_NAME: Record<string, string> = {
  "tps-board": "TPS Board",
  "toledo-city-council": "City Council",
  "lucas-county-commissioners": "County",
};

export function bodyShortName(slug: string | null, fallback: string): string {
  if (!slug) return fallback;
  return SHORT_NAME[slug] ?? fallback;
}

/** "City Council vote", the kind label the Latest feed shows. */
export function bodyVoteKind(slug: string | null, fallback: string): string {
  return `${bodyShortName(slug, fallback)} vote`;
}

/** The body filter, first control on Vote Watch. */
export const BODY_FILTERS = [
  { key: "all", label: "All bodies" },
  { key: "tps-board", label: "TPS Board" },
  { key: "toledo-city-council", label: "City Council" },
  { key: "lucas-county-commissioners", label: "County" },
] as const;

/** Sorts a list of body slugs into BODY_ORDER, unknown slugs last by name. */
export function compareBodies(a: string | null, b: string | null): number {
  const rank = (slug: string | null) => {
    const index = BODY_ORDER.indexOf((slug ?? "") as (typeof BODY_ORDER)[number]);
    return index === -1 ? BODY_ORDER.length : index;
  };
  const difference = rank(a) - rank(b);
  if (difference !== 0) return difference;
  return (a ?? "").localeCompare(b ?? "");
}
