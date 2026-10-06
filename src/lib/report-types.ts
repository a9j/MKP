/**
 * Report shapes and labels.
 *
 * Kept apart from the queries because the filter bar is a client component,
 * and importing the query module would drag the service role client into the
 * browser bundle. The "server-only" guard catches that, which is how this file
 * came to exist.
 */

export type ReportType =
  | "pay_report"
  | "levy_explainer"
  | "contract_tracker"
  | "ballot_explainer";

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  pay_report: "Pay Report",
  levy_explainer: "Levy Explainer",
  contract_tracker: "Contract Tracker",
  ballot_explainer: "Ballot Explainer",
};

/** The filter bar on /reports. */
export const REPORT_FILTERS = [
  { key: "all", label: "All reports" },
  { key: "pay_report", label: "Pay Report" },
  { key: "levy_explainer", label: "Levy Explainer" },
  { key: "contract_tracker", label: "Contract Tracker" },
  { key: "ballot_explainer", label: "Ballot Explainer" },
] as const;

/**
 * The types that explain something on a ballot.
 *
 * A levy explainer and a ballot explainer answer the same three questions
 * about the same kind of thing: a levy is one of the issues on the ballot. The
 * site keeps them as separate types, because the organization distinguishes a
 * school levy from a library levy or a charter amendment, and treats them the
 * same wherever a reader is asking "what am I voting on".
 */
export const EXPLAINER_TYPES = ["ballot_explainer", "levy_explainer"] as const;

export function isExplainer(type: string): boolean {
  return (EXPLAINER_TYPES as readonly string[]).includes(type);
}

/**
 * Sorts "Issue 2" above "Issue 12", which a plain string sort does not. The
 * number is compared as a number where there is one, and anything without a
 * number sorts last by its own text, so a lettered issue still has an order.
 */
export function compareIssueNumbers(a: string | null, b: string | null): number {
  const digits = (value: string | null) => {
    const match = (value ?? "").match(/\d+/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
  };
  const difference = digits(a) - digits(b);
  if (difference !== 0 && Number.isFinite(difference)) return difference;
  return (a ?? "").localeCompare(b ?? "");
}

export type ReportSource = { label: string; url: string };

export type Report = {
  id: string;
  slug: string;
  title: string;
  type: ReportType;
  typeLabel: string;
  reportDate: string;
  reportDateLabel: string;
  summary: string;
  /** Full explainer text, markdown. Empty when the report is PDF only. */
  body: string;
  status: "draft" | "published";
  pdfUrl: string | null;
  pdfName: string | null;
  sources: ReportSource[];
  /** The election this explains, and the issue as the ballot prints it. */
  ballotDate: string | null;
  ballotDateLabel: string | null;
  issueNumber: string | null;
  /** The three an explainer always answers, and the one it sometimes does. */
  asksFor: string | null;
  funds: string | null;
  ifFails: string | null;
  homeownerCost: string | null;
};
