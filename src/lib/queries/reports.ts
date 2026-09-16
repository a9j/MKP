import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";
import { documentUrl, formatDay } from "@/lib/queries/records";
import {
  REPORT_TYPE_LABEL,
  type Report,
  type ReportType,
} from "@/lib/report-types";

export type { Report, ReportType, ReportSource } from "@/lib/report-types";
export { REPORT_TYPE_LABEL, REPORT_FILTERS } from "@/lib/report-types";

type Row = {
  id: string;
  slug: string;
  title: string;
  type: string;
  report_date: string;
  summary: string | null;
  status: string;
  report_sources?: { label: string; url: string; sort_order: number }[] | null;
};

const SELECT = "id, slug, title, type, report_date, summary, status, report_sources(label, url, sort_order)";

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
      status: row.status as "draft" | "published",
      pdfUrl: document ? documentUrl(document.storage_path) : null,
      pdfName: document?.file_name ?? null,
      sources: [...(row.report_sources ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ label: s.label, url: s.url })),
    };
  });
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
