import { createPublicClient } from "@/lib/supabase/public";
import { env } from "@/lib/env";

export type RequestStatus = "filed" | "partial" | "fulfilled" | "denied";

export type RecordDocument = {
  fileName: string;
  url: string;
  fileSize: number | null;
  pageCount: number | null;
};

export type RecordsRequest = {
  id: string;
  dateFiled: string;
  dateFiledLabel: string;
  agencyName: string;
  requestText: string;
  status: RequestStatus;
  statusLabel: string;
  dateResponded: string | null;
  denialReason: string | null;
  /** Null while the request is still open. */
  responseBusinessDays: number | null;
  openBusinessDays: number | null;
  documents: RecordDocument[];
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  filed: "Filed",
  partial: "Partial",
  fulfilled: "Fulfilled",
  denied: "Denied",
};

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Public URL for a file in the documents bucket, which is public read. */
export function documentUrl(storagePath: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/documents/${storagePath}`;
}

export async function getRecordsRequests(): Promise<RecordsRequest[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("records_request_log")
    .select(
      "id, date_filed, agency_name, request_text, status, date_responded, denial_reason, response_business_days, open_business_days",
    )
    .order("date_filed", { ascending: false });
  if (error) throw new Error(`Could not load the records request log: ${error.message}`);

  const rows = data ?? [];
  const ids = rows.map((r) => r.id).filter((id): id is string => Boolean(id));

  const { data: documents, error: documentsError } = ids.length
    ? await supabase
        .from("documents")
        .select("owner_id, storage_path, file_name, file_size, page_count")
        .eq("owner_type", "records_request")
        .in("owner_id", ids)
    : { data: [], error: null };
  if (documentsError) throw new Error(`Could not load documents: ${documentsError.message}`);

  const byRequest = new Map<string, RecordDocument[]>();
  for (const doc of documents ?? []) {
    if (!doc.owner_id) continue;
    const list = byRequest.get(doc.owner_id) ?? [];
    list.push({
      fileName: doc.file_name,
      url: documentUrl(doc.storage_path),
      fileSize: doc.file_size,
      pageCount: doc.page_count,
    });
    byRequest.set(doc.owner_id, list);
  }

  return rows
    .filter((r) => r.id && r.date_filed && r.agency_name && r.request_text && r.status)
    .map((r) => ({
      id: r.id!,
      dateFiled: r.date_filed!,
      dateFiledLabel: formatDay(r.date_filed!),
      agencyName: r.agency_name!,
      requestText: r.request_text!,
      status: r.status as RequestStatus,
      statusLabel: STATUS_LABEL[r.status as RequestStatus],
      dateResponded: r.date_responded,
      denialReason: r.denial_reason,
      responseBusinessDays: r.response_business_days,
      openBusinessDays: r.open_business_days,
      documents: byRequest.get(r.id!) ?? [],
    }));
}

export async function getAgencies() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, records_officer_email, records_officer_name, website")
    .order("name");
  if (error) throw new Error(`Could not load agencies: ${error.message}`);
  return data ?? [];
}
