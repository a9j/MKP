/**
 * Report shapes and labels.
 *
 * Kept apart from the queries because the filter bar is a client component,
 * and importing the query module would drag the service role client into the
 * browser bundle. The "server-only" guard catches that, which is how this file
 * came to exist.
 */

export type ReportType = "pay_report" | "levy_explainer" | "contract_tracker";

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  pay_report: "Pay Report",
  levy_explainer: "Levy Explainer",
  contract_tracker: "Contract Tracker",
};

/** The filter bar on /reports. */
export const REPORT_FILTERS = [
  { key: "all", label: "All reports" },
  { key: "pay_report", label: "Pay Report" },
  { key: "levy_explainer", label: "Levy Explainer" },
  { key: "contract_tracker", label: "Contract Tracker" },
] as const;

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
  status: "draft" | "published";
  pdfUrl: string | null;
  pdfName: string | null;
  sources: ReportSource[];
};
