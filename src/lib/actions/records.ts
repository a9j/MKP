"use server";

import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import { MAX_DOCUMENT_BYTES } from "@/lib/limits";

export type RequestStatus = "filed" | "partial" | "fulfilled" | "denied";
export type SaveResult = { ok: boolean; message: string; fieldErrors: Record<string, string> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Creates a records request and attaches its documents.
 *
 * Takes FormData because the files come with it. There is no draft state: a
 * request is a fact about what was filed, so saving publishes it.
 */
export async function createRecordsRequest(form: FormData): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) {
      return { ok: false, message: error.message, fieldErrors: {} };
    }
    throw error;
  }

  const agencyId = String(form.get("agencyId") ?? "");
  const requestText = String(form.get("requestText") ?? "").trim();
  const dateFiled = String(form.get("dateFiled") ?? "");
  const status = String(form.get("status") ?? "filed") as RequestStatus;
  const dateResponded = String(form.get("dateResponded") ?? "").trim();
  const denialReason = String(form.get("denialReason") ?? "").trim();
  const files = form.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);

  const fieldErrors: Record<string, string> = {};
  if (!agencyId) fieldErrors.agencyId = "Choose which agency the request went to.";
  if (requestText.length === 0) fieldErrors.requestText = "Write what you asked for.";
  if (!ISO_DATE.test(dateFiled)) fieldErrors.dateFiled = "Give the date the request was filed.";
  if (dateResponded.length > 0 && !ISO_DATE.test(dateResponded)) {
    fieldErrors.dateResponded = "Give a date, or leave it empty.";
  }
  if (dateResponded && dateResponded < dateFiled) {
    fieldErrors.dateResponded = "The response cannot be dated before the request.";
  }
  // The database enforces this too, since a denial with no stated reason is
  // exactly what the Records Desk exists to surface.
  if (status === "denied" && denialReason.length === 0) {
    fieldErrors.denialReason = "A denial must record the reason the office gave.";
  }
  if (status !== "filed" && dateResponded.length === 0) {
    fieldErrors.dateResponded = "Give the date the office responded.";
  }

  for (const file of files) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      fieldErrors.documents = `${file.name} is not a PDF.`;
    } else if (file.size > MAX_DOCUMENT_BYTES) {
      fieldErrors.documents = `${file.name} is larger than 25MB.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was saved. Check the fields marked below.", fieldErrors };
  }

  const supabase = await createServerSupabase();

  const { data: inserted, error } = await supabase
    .from("records_requests")
    .insert({
      agency_id: agencyId,
      request_text: requestText,
      date_filed: dateFiled,
      status,
      date_responded: dateResponded || null,
      denial_reason: status === "denied" ? denialReason : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, message: `Nothing was saved: ${error?.message}`, fieldErrors: {} };
  }

  const failed: string[] = [];
  for (const file of files) {
    const path = `records/${inserted.id}/${Date.now()}-${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      failed.push(file.name);
      continue;
    }

    await supabase.from("documents").insert({
      owner_type: "records_request",
      owner_id: inserted.id,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
    });
  }

  revalidateFor("record");

  if (failed.length > 0) {
    return {
      ok: true,
      message: `Request published, but ${failed.length} file(s) did not upload: ${failed.join(", ")}. Add them again.`,
      fieldErrors: {},
    };
  }

  return {
    ok: true,
    message:
      files.length > 0
        ? `Request published with ${files.length} document${files.length === 1 ? "" : "s"}.`
        : "Request published.",
    fieldErrors: {},
  };
}

/** Keeps a storage key predictable without losing the original file name. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

export async function addAgency(name: string, officerEmail: string): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) {
      return { ok: false, message: error.message, fieldErrors: {} };
    }
    throw error;
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Give the agency a name.", fieldErrors: { name: "Required." } };
  }
  if (officerEmail.trim().length > 0 && !officerEmail.includes("@")) {
    return {
      ok: false,
      message: "That does not look like an email address.",
      fieldErrors: { officerEmail: "Check the address." },
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("agencies")
    .insert({ name: trimmed, records_officer_email: officerEmail.trim() || null });

  if (error) return { ok: false, message: `Not added: ${error.message}`, fieldErrors: {} };

  revalidateFor("record");
  return { ok: true, message: `${trimmed} added.`, fieldErrors: {} };
}
