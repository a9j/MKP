/**
 * The same levy, published in two shapes.
 *
 * A levy reaches a reader two ways. `reports` holds the written explainer,
 * which reads straight down the page and downloads as a PDF. The templated
 * explainer system holds the structured page at /levy/[slug], which carries
 * the figures as sourced fields and the calculator. Neither is a copy of the
 * other, and a reader who lands on one should be able to get to the other
 * rather than having to know both exist.
 *
 * The pairing is listed here rather than stored, because it is editorial: it
 * says these two pages are about the same ballot issue. A slug missing from
 * this list simply shows no companion link, so an unpaired page is a page
 * with one less link and never a broken one.
 */
export type LevyPair = { reportSlug: string; levySlug: string };

export const LEVY_PAIRS: readonly LevyPair[] = [
  {
    reportSlug: "issue-9-tps-levy-explainer",
    levySlug: "issue-9-toledo-public-schools-levy",
  },
  {
    reportSlug: "issue-8-library-levy-explainer",
    levySlug: "issue-8-toledo-lucas-county-public-library-levy",
  },
  {
    reportSlug: "issue-13-imagination-station-levy-explainer",
    levySlug: "issue-13-imagination-station-levy-renewal",
  },
];

/** The structured levy page for a written report, if there is one. */
export function levyPageForReport(reportSlug: string): string | null {
  return LEVY_PAIRS.find((p) => p.reportSlug === reportSlug)?.levySlug ?? null;
}

/** The written report for a structured levy page, if there is one. */
export function reportForLevyPage(levySlug: string): string | null {
  return LEVY_PAIRS.find((p) => p.levySlug === levySlug)?.reportSlug ?? null;
}
