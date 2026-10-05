/**
 * Shapes and labels for the ballot, levy and contract explainers.
 *
 * Kept apart from the query module for the same reason as report-types.ts:
 * the filter bar and the calculator are client components, and the query
 * module reaches for server-only clients.
 */

export type Template = "ballot" | "levy" | "contract";

export const TEMPLATES: Template[] = ["ballot", "levy", "contract"];

export function isTemplate(value: unknown): value is Template {
  return value === "ballot" || value === "levy" || value === "contract";
}

export const TEMPLATE_LABEL: Record<Template, string> = {
  ballot: "Ballot Explainer",
  levy: "Levy Explainer",
  contract: "Contract Tracker",
};

/** The kind each template is stored under. See 0011_explainer_templates.sql. */
export const TEMPLATE_KIND = {
  ballot: "ballot_issue",
  levy: "levy",
  contract: "contract",
} as const;

/** Public address of a templated explainer: /ballot/slug, /levy/slug, /contract/slug. */
export function explainerPath(template: Template, slug: string): string {
  return `/${template}/${slug}`;
}

export const EXPLAINER_FILTERS = [
  { key: "all", label: "All explainers" },
  { key: "ballot", label: "Ballot" },
  { key: "levy", label: "Levy" },
  { key: "contract", label: "Contract" },
] as const;

export type LevyKind = "new" | "renewal" | "replacement" | "additional" | "renewal_with_increase";

export const LEVY_KIND_LABEL: Record<LevyKind, string> = {
  new: "New levy",
  renewal: "Renewal",
  replacement: "Replacement",
  additional: "Additional levy",
  renewal_with_increase: "Renewal with an increase",
};

export type ContractEventType =
  | "talks_opened"
  | "session"
  | "offer"
  | "counteroffer"
  | "board_vote"
  | "union_vote"
  | "mediation"
  | "agreement"
  | "other";

export const CONTRACT_EVENT_LABEL: Record<ContractEventType, string> = {
  talks_opened: "Talks opened",
  session: "Bargaining session",
  offer: "Offer",
  counteroffer: "Counteroffer",
  board_vote: "Board vote",
  union_vote: "Union vote",
  mediation: "Mediation",
  agreement: "Agreement",
  other: "Update",
};

/** Every explainer page closes with this, in the site's voice. */
export const EXPLAINER_NEUTRALITY =
  "The Mona K Project explains public records. We do not take positions, endorse candidates, or recommend how to vote.";

// ---------------------------------------------------------------------------
// The snapshot publish_explainer() freezes, as the public pages read it.
// ---------------------------------------------------------------------------

export type ExplainerSource = {
  id: string;
  label: string;
  url: string;
  documentDate: string | null;
  note: string | null;
};

export type BallotIssue = {
  id: string;
  issueNumber: string | null;
  title: string;
  jurisdiction: string | null;
  whatYesMeans: string;
  whatNoMeans: string;
  costNote: string | null;
  costSourceId: string | null;
  linkedLevySlug: string | null;
};

export type LevyFigures = {
  districtOrBody: string;
  levyKind: LevyKind;
  mills: number | null;
  years: number | null;
  purpose: string | null;
  estimatedAnnualRevenue: number | null;
  costPer100k: number | null;
  millsSourceId: string | null;
  revenueSourceId: string | null;
  costSourceId: string | null;
};

export type ContractEvent = {
  id: string;
  eventDate: string;
  eventType: ContractEventType;
  headline: string;
  description: string | null;
  sourceId: string | null;
};

export type Explainer = {
  id: string;
  slug: string;
  template: Template;
  title: string;
  summary: string;
  oneSentence: string | null;
  decisionDate: string | null;
  currentStatus: string | null;
  pdfUrl: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  isSample: boolean;
  /** When this version went out. Null on an unpublished preview. */
  updatedAt: string | null;
  version: number;
  changeNote: string | null;
  sources: ExplainerSource[];
  ballotIssues: BallotIssue[];
  levy: LevyFigures | null;
  contractEvents: ContractEvent[];
};

/** A row on the index and the home page: just enough for a card. */
export type ExplainerCard = {
  id: string;
  slug: string;
  template: Template;
  title: string;
  summary: string;
  decisionDate: string | null;
  updatedAt: string | null;
};

/** "2026-10-02T14:03:00Z" or "2026-10-02" to "Oct 2, 2026", Toledo time. */
export function explainerDate(value: string): string {
  const options = { month: "short", day: "numeric", year: "numeric" } as const;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // A bare date is a calendar day, not an instant: built from parts so it
    // cannot shift a day in either direction.
    const [y, m, d] = value.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
  }
  return new Date(value).toLocaleDateString("en-US", { ...options, timeZone: "America/New_York" });
}
