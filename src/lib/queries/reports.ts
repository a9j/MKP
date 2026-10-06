import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { documentUrl, formatDay } from "@/lib/queries/records";
import {
  REPORT_TYPE_LABEL,
  compareIssueNumbers,
  isExplainer,
  type Report,
  type ReportType,
} from "@/lib/report-types";

export type { Report, ReportType, ReportSource } from "@/lib/report-types";
export { REPORT_TYPE_LABEL, REPORT_FILTERS, isExplainer } from "@/lib/report-types";

type Row = {
  id: string;
  slug: string;
  title: string;
  type: string;
  report_date: string;
  summary: string | null;
  body: string | null;
  status: string;
  ballot_date: string | null;
  issue_number: string | null;
  asks_for: string | null;
  funds: string | null;
  if_fails: string | null;
  homeowner_cost: string | null;
  report_sources?: { label: string; url: string; sort_order: number }[] | null;
};

// One string literal, not a concatenation: supabase-js reads this at the type
// level to work out the shape of a row, and it can only do that with a literal.
const SELECT = "id, slug, title, type, report_date, summary, body, status, ballot_date, issue_number, asks_for, funds, if_fails, homeowner_cost, report_sources(label, url, sort_order)";

async function attachDocuments(
  client: ReturnType<typeof createPublicClient>,
  rows: Row[],
): Promise<Report[]> {
  const ids = rows.map((r) => r.id);
  const { data: documents } = ids.length
    ? await client
        .from("documents")
        .select("owner_id, storage_path, file_name")
        .eq("owner_type", "report")
        .in("owner_id", ids)
    : { data: [] };

  const byReport = new Map((documents ?? []).map((d) => [d.owner_id ?? "", d]));

  return rows.map((row) => {
    const document = byReport.get(row.id);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      type: row.type as ReportType,
      typeLabel: REPORT_TYPE_LABEL[row.type as ReportType],
      reportDate: row.report_date,
      reportDateLabel: formatDay(row.report_date),
      summary: row.summary ?? "",
      body: row.body ?? "",
      status: row.status as "draft" | "published",
      pdfUrl: document ? documentUrl(document.storage_path) : null,
      pdfName: document?.file_name ?? null,
      sources: [...(row.report_sources ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ label: s.label, url: s.url })),
      ballotDate: row.ballot_date,
      ballotDateLabel: row.ballot_date ? formatDay(row.ballot_date) : null,
      issueNumber: row.issue_number,
      asksFor: row.asks_for,
      funds: row.funds,
      ifFails: row.if_fails,
      homeownerCost: row.homeowner_cost,
    };
  });
}

/**
 * The same explainers, one entry per election date.
 *
 * Usually there is one election coming and so one heading, which is the shape
 * the brief describes. When two are, each gets its own heading with its own
 * date, because a single heading carrying the soonest date would be labelling
 * issues that are not on that ballot.
 */
export function ballotGroups(
  reports: Report[],
  today = new Date(),
): { date: string; label: string; reports: Report[] }[] {
  const groups = new Map<string, { date: string; label: string; reports: Report[] }>();
  for (const report of onTheBallot(reports, today)) {
    const date = report.ballotDate!;
    const group = groups.get(date);
    if (group) group.reports.push(report);
    else groups.set(date, { date, label: report.ballotDateLabel!, reports: [report] });
  }
  return [...groups.values()];
}

/**
 * The explainers for an election that has not happened yet, soonest ballot
 * first and then by issue number.
 *
 * "Not happened yet" is decided against the date the page is built, which is
 * what puts an explainer under the "On the ballot" heading and takes it out
 * again the day after the election without anybody editing it.
 */
export function onTheBallot(reports: Report[], today = new Date()): Report[] {
  const cutoff = today.toISOString().slice(0, 10);
  return reports
    .filter((report) => isExplainer(report.type) && report.ballotDate && report.ballotDate >= cutoff)
    .sort(
      (a, b) =>
        (a.ballotDate ?? "").localeCompare(b.ballotDate ?? "") ||
        compareIssueNumbers(a.issueNumber, b.issueNumber),
    );
}

/** Published reports only. RLS hides drafts from the anonymous key as well. */
export async function getPublishedReports(): Promise<Report[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reports")
    .select(SELECT)
    .eq("status", "published")
    .order("report_date", { ascending: false });
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return attachDocuments(supabase, (data ?? []) as Row[]);
}

export async function getPublishedReport(slug: string): Promise<Report | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reports")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Could not load the report: ${error.message}`);
  if (!data) return null;
  return (await attachDocuments(supabase, [data as Row]))[0];
}

/**
 * A draft by its preview token, for the unlisted review link.
 *
 * Read through the service role because RLS hides drafts from the anonymous
 * key, which is what stops the preview route from being turned into a way to
 * list unpublished work: the only way in is an exact match on a token nobody
 * can guess.
 */
export async function getReportByPreviewToken(token: string): Promise<Report | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("reports")
    .select(SELECT)
    .eq("preview_token", token)
    .maybeSingle();
  if (error) throw new Error(`Could not load the preview: ${error.message}`);
  if (!data) return null;
  return (await attachDocuments(service as never, [data as Row]))[0];
}
