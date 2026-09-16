"use server";

import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import { sendEmail, renderEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { SUMMARY_MARKDOWN_MAX, MAX_DOCUMENT_BYTES } from "@/lib/limits";
import { slugify as slugOf } from "@/lib/slug";

export type SaveResult = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
  slug?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;



export async function saveReport(form: FormData): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) {
      return { ok: false, message: error.message, fieldErrors: {} };
    }
    throw error;
  }

  const id = String(form.get("id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const typedSlug = String(form.get("slug") ?? "").trim();
  const type = String(form.get("type") ?? "pay_report");
  const reportDate = String(form.get("reportDate") ?? "");
  const summary = String(form.get("summary") ?? "").trim();
  const status = String(form.get("status") ?? "draft") as "draft" | "published";

  const labels = form.getAll("sourceLabel").map((v) => String(v).trim());
  const urls = form.getAll("sourceUrl").map((v) => String(v).trim());
  const sources = labels
    .map((label, i) => ({ label, url: urls[i] ?? "" }))
    .filter((s) => s.label.length > 0 || s.url.length > 0);

  const file = form.get("pdf");
  const pdf = file instanceof File && file.size > 0 ? file : null;

  const fieldErrors: Record<string, string> = {};
  if (title.length === 0) fieldErrors.title = "Give the report a title.";
  if (!ISO_DATE.test(reportDate)) fieldErrors.reportDate = "Give the report date.";
  if (summary.length === 0) {
    fieldErrors.summary = "Write a summary.";
  } else if (summary.length > SUMMARY_MARKDOWN_MAX) {
    fieldErrors.summary = `${summary.length} characters. The limit is ${SUMMARY_MARKDOWN_MAX}.`;
  }

  // At least one source, because a report with nothing behind it is exactly
  // what this organization exists not to publish.
  if (sources.length === 0) {
    fieldErrors.sources = "A report needs at least one source.";
  } else {
    sources.forEach((source, i) => {
      if (source.label.length === 0) fieldErrors[`sourceLabel${i}`] = "Give the source a label.";
      if (!/^https?:\/\/\S+$/i.test(source.url)) {
        fieldErrors[`sourceUrl${i}`] = "Give a link starting with http:// or https://.";
      }
    });
  }

  if (pdf) {
    if (pdf.type !== "application/pdf" && !pdf.name.toLowerCase().endsWith(".pdf")) {
      fieldErrors.pdf = `${pdf.name} is not a PDF.`;
    } else if (pdf.size > MAX_DOCUMENT_BYTES) {
      fieldErrors.pdf = `${pdf.name} is larger than 25MB.`;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was saved. Check the fields marked below.", fieldErrors };
  }

  const slug = (typedSlug.length > 0 ? slugOf(typedSlug) : slugOf(title)) || "report";
  const supabase = await createServerSupabase();

  const row = {
    slug,
    title,
    type: type as "pay_report" | "levy_explainer" | "contract_tracker",
    report_date: reportDate,
    summary,
    status,
    // Set the first time it goes out, and left alone afterwards so an edit
    // does not rewrite the publication date.
    ...(status === "published" ? { published_at: new Date().toISOString() } : {}),
  };

  let reportId = id;

  if (id) {
    const { data: existing } = await supabase
      .from("reports")
      .select("published_at, status")
      .eq("id", id)
      .maybeSingle();

    const keepPublishedAt =
      existing?.status === "published" && existing.published_at
        ? { published_at: existing.published_at }
        : {};

    const { error } = await supabase
      .from("reports")
      .update({ ...row, ...keepPublishedAt })
      .eq("id", id);
    if (error) return { ok: false, message: `Nothing was saved: ${error.message}`, fieldErrors: {} };
  } else {
    const { data: inserted, error } = await supabase
      .from("reports")
      .insert(row)
      .select("id")
      .single();
    if (error || !inserted) {
      const duplicate = error?.code === "23505";
      return {
        ok: false,
        message: duplicate
          ? `A report already uses the address "${slug}". Give this one a different slug.`
          : `Nothing was saved: ${error?.message}`,
        fieldErrors: duplicate ? { slug: "Already in use." } : {},
      };
    }
    reportId = inserted.id;
  }

  // Sources are replaced wholesale, which is simpler to reason about than
  // matching rows and cannot leave an edited report citing a stale document.
  await supabase.from("report_sources").delete().eq("report_id", reportId);
  const { error: sourcesError } = await supabase.from("report_sources").insert(
    sources.map((source, i) => ({
      report_id: reportId,
      label: source.label,
      url: source.url,
      sort_order: i,
    })),
  );
  if (sourcesError) {
    return { ok: false, message: `Saved, but the sources failed: ${sourcesError.message}`, fieldErrors: {} };
  }

  if (pdf) {
    const path = `reports/${reportId}/${Date.now()}-${pdf.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80)}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, pdf, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      return {
        ok: true,
        message: `Report saved, but the PDF did not upload: ${uploadError.message}`,
        fieldErrors: {},
        slug,
      };
    }

    // One PDF per report: the new one replaces whatever was there.
    await supabase.from("documents").delete().eq("owner_type", "report").eq("owner_id", reportId);
    await supabase.from("documents").insert({
      owner_type: "report",
      owner_id: reportId,
      storage_path: path,
      file_name: pdf.name,
      file_size: pdf.size,
    });
  }

  revalidateFor("report", [`/reports/${slug}`]);

  return {
    ok: true,
    message: status === "published" ? "Report published." : "Report saved as draft.",
    fieldErrors: {},
    slug,
  };
}

export type CouncilSendResult = { ok: boolean; message: string };

/**
 * Emails the advisory council a link to the draft.
 *
 * The preview link works without a login, because asking a volunteer reviewer
 * to hold an account is how a report goes out unreviewed.
 */
export async function sendToCouncil(reportId: string): Promise<CouncilSendResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return { ok: false, message: error.message };
    throw error;
  }

  const supabase = await createServerSupabase();

  const { data: report } = await supabase
    .from("reports")
    .select("title, preview_token, status, report_date")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) return { ok: false, message: "That report no longer exists." };

  const { data: council } = await supabase
    .from("people")
    .select("name, email")
    .eq("role", "advisory")
    .eq("active", true);

  const recipients = (council ?? [])
    .map((person) => person.email)
    .filter((email): email is string => Boolean(email && email.includes("@")));

  if (recipients.length === 0) {
    return {
      ok: false,
      message:
        "No advisory council member has an email address on file. Add one under People first.",
    };
  }

  const url = `${env.siteUrl}/reports/preview/${report.preview_token}`;
  const { html, text } = renderEmail({
    title: "A report is ready for your review",
    body: [
      `${report.title} is ready for the advisory council to read before it goes out.`,
      "The link below opens the draft. It does not require an account, so please keep it to yourself.",
      "If anything in it is wrong, or reads as taking a side, say so. That is what the review is for.",
    ],
    action: { label: "Read the draft", url },
  });

  const result = await sendEmail({
    to: recipients,
    subject: `For review: ${report.title}`,
    text,
    html,
  });

  if (!result.ok) return { ok: false, message: result.message };

  return {
    ok: true,
    message: result.local
      ? `Written to .local-storage/emails for ${result.recipients} council member(s). Set RESEND_API_KEY to send for real.`
      : `Preview link sent to ${result.recipients} council member${result.recipients === 1 ? "" : "s"}.`,
  };
}
