/**
 * What the explainer editor sends to saveExplainer(), as JSON.
 *
 * Sources are matched by key rather than by id, because a figure can cite a
 * source that was added in the same edit and does not have an id yet. A
 * saved source's key is its id; a new one gets a temporary key, and the
 * server swaps it for the id once the row exists.
 *
 * Numbers stay strings here so a half typed "2." is not lost on the way.
 */
export type SourcePayload = {
  key: string;
  id: string | null;
  label: string;
  url: string;
  documentDate: string;
  note: string;
};

export type IssuePayload = {
  key: string;
  id: string | null;
  issueNumber: string;
  title: string;
  jurisdiction: string;
  whatYesMeans: string;
  whatNoMeans: string;
  costNote: string;
  costSourceKey: string | null;
  linkedLevyId: string | null;
};

export type LevyPayload = {
  districtOrBody: string;
  levyKind: string;
  mills: string;
  years: string;
  purpose: string;
  estimatedAnnualRevenue: string;
  costPer100k: string;
  millsSourceKey: string | null;
  revenueSourceKey: string | null;
  costSourceKey: string | null;
};

export type EventPayload = {
  key: string;
  id: string | null;
  eventDate: string;
  eventType: string;
  headline: string;
  description: string;
  sourceKey: string | null;
};

export type ExplainerPayload = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  oneSentence: string;
  decisionDate: string;
  currentStatus: string;
  heroImagePath: string | null;
  heroImageAlt: string;
  removeHeroImage: boolean;
  removePdf: boolean;
  sources: SourcePayload[];
  issues: IssuePayload[];
  levy: LevyPayload | null;
  events: EventPayload[];
};
