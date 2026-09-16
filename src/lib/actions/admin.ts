"use server";

import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import { sendEmail, renderEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { MAX_DOCUMENT_BYTES } from "@/lib/limits";

export type SaveResult = { ok: boolean; message: string; fieldErrors: Record<string, string> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function refused(error: unknown): SaveResult | null {
  if (error instanceof NotAnAdminError) {
    return { ok: false, message: error.message, fieldErrors: {} };
  }
  return null;
}

/* -------------------------------------------------------------------------
   Listening sessions
   ------------------------------------------------------------------------- */

export async function saveListeningSession(form: FormData): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    const r = refused(error);
    if (r) return r;
    throw error;
  }

  const id = String(form.get("id") ?? "").trim();
  const sessionDate = String(form.get("sessionDate") ?? "");
  const audience = String(form.get("audience") ?? "teachers") as "teachers" | "parents";
  const attendeeCount = String(form.get("attendeeCount") ?? "").trim();
  const summary = String(form.get("summary") ?? "").trim();
  const status = String(form.get("status") ?? "draft") as "draft" | "published";
  const heard = form.getAll("heard").map((v) => String(v).trim()).filter(Boolean);
  const changes = form.getAll("changes").map((v) => String(v).trim()).filter(Boolean);

  const fieldErrors: Record<string, string> = {};
  if (!ISO_DATE.test(sessionDate)) fieldErrors.sessionDate = "Give the session date.";
  if (summary.length === 0) fieldErrors.summary = "Write a summary.";
  if (attendeeCount.length > 0 && !/^\d+$/.test(attendeeCount)) {
    fieldErrors.attendeeCount = "Attendee count must be a whole number, or left empty.";
  }
  // The copy doc promises that what we hear is published and shapes what we
  // build. A summary with neither list does neither.
  if (heard.length === 0) fieldErrors.heard = "Record at least one thing you heard.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was saved. Check the fields marked below.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  const row = {
    session_date: sessionDate,
    audience,
    attendee_count: attendeeCount ? Number(attendeeCount) : null,
    summary,
    status,
    ...(status === "published" ? { published_at: new Date().toISOString() } : {}),
  };

  let sessionId = id;
  if (id) {
    const { error } = await supabase.from("listening_sessions").update(row).eq("id", id);
    if (error) return { ok: false, message: `Nothing was saved: ${error.message}`, fieldErrors: {} };
  } else {
    const { data, error } = await supabase
      .from("listening_sessions")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, message: `Nothing was saved: ${error?.message}`, fieldErrors: {} };
    }
    sessionId = data.id;
  }

  await supabase.from("listening_points").delete().eq("session_id", sessionId);
  const points = [
    ...heard.map((text, i) => ({ session_id: sessionId, kind: "heard", text, sort_order: i })),
    ...changes.map((text, i) => ({ session_id: sessionId, kind: "changes", text, sort_order: i })),
  ];
  if (points.length > 0) await supabase.from("listening_points").insert(points);

  revalidateFor("listening");
  return {
    ok: true,
    message: status === "published" ? "Listening summary published." : "Listening summary saved as draft.",
    fieldErrors: {},
  };
}

/* -------------------------------------------------------------------------
   People
   ------------------------------------------------------------------------- */

export async function savePerson(form: FormData): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    const r = refused(error);
    if (r) return r;
    throw error;
  }

  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const role = String(form.get("role") ?? "staff") as
    | "staff"
    | "board"
    | "advisory"
    | "body_member";
  const bodyId = String(form.get("bodyId") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const termStart = String(form.get("termStart") ?? "").trim();
  const termEnd = String(form.get("termEnd") ?? "").trim();
  const bio = String(form.get("bio") ?? "").trim();
  const sortOrder = String(form.get("sortOrder") ?? "0").trim();
  const active = form.get("active") !== null;
  const photo = form.get("photo");

  const fieldErrors: Record<string, string> = {};
  if (name.length === 0) fieldErrors.name = "Give the person a name.";
  if (email.length > 0 && !email.includes("@")) fieldErrors.email = "Check the email address.";
  if (role === "body_member" && !bodyId) {
    fieldErrors.bodyId = "An elected member needs the body they sit on.";
  }
  if (termStart && !ISO_DATE.test(termStart)) fieldErrors.termStart = "Give a date, or leave empty.";
  if (termEnd && !ISO_DATE.test(termEnd)) fieldErrors.termEnd = "Give a date, or leave empty.";
  if (termStart && termEnd && termEnd < termStart) {
    fieldErrors.termEnd = "The term cannot end before it starts.";
  }
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) fieldErrors.photo = `${photo.name} is not an image.`;
    else if (photo.size > MAX_DOCUMENT_BYTES) fieldErrors.photo = `${photo.name} is too large.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was saved. Check the fields marked below.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  const row = {
    name,
    title: title || null,
    role,
    body_id: role === "body_member" ? bodyId : null,
    email: email || null,
    term_start: termStart || null,
    term_end: termEnd || null,
    bio: bio || null,
    active,
    sort_order: Number(sortOrder) || 0,
  };

  let personId = id;
  if (id) {
    const { error } = await supabase.from("people").update(row).eq("id", id);
    if (error) return { ok: false, message: `Nothing was saved: ${error.message}`, fieldErrors: {} };
  } else {
    const { data, error } = await supabase.from("people").insert(row).select("id").single();
    if (error || !data) {
      return { ok: false, message: `Nothing was saved: ${error?.message}`, fieldErrors: {} };
    }
    personId = data.id;
  }

  if (photo instanceof File && photo.size > 0) {
    const path = `people/${personId}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60)}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, photo, { contentType: photo.type, upsert: false });
    if (!uploadError) {
      await supabase.from("people").update({ photo_path: path }).eq("id", personId);
    }
  }

  revalidateFor("person");
  return { ok: true, message: `${name} saved.`, fieldErrors: {} };
}

/* -------------------------------------------------------------------------
   Corrections
   ------------------------------------------------------------------------- */

export async function logCorrection(form: FormData): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    const r = refused(error);
    if (r) return r;
    throw error;
  }

  const correctionDate = String(form.get("correctionDate") ?? "");
  const pagePath = String(form.get("pagePath") ?? "").trim();
  const whatChanged = String(form.get("whatChanged") ?? "").trim();
  const why = String(form.get("why") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!ISO_DATE.test(correctionDate)) fieldErrors.correctionDate = "Give the date.";
  if (!pagePath.startsWith("/")) fieldErrors.pagePath = "Give the page path, starting with a slash.";
  if (whatChanged.length === 0) fieldErrors.whatChanged = "Say what changed.";
  // A correction with no reason is not a correction, it is an edit.
  if (why.length === 0) fieldErrors.why = "Say why it changed.";

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was logged. Check the fields marked below.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("corrections").insert({
    correction_date: correctionDate,
    page_path: pagePath,
    what_changed: whatChanged,
    why,
  });
  if (error) return { ok: false, message: `Nothing was logged: ${error.message}`, fieldErrors: {} };

  revalidateFor("correction", [pagePath]);
  return { ok: true, message: "Correction published.", fieldErrors: {} };
}

/* -------------------------------------------------------------------------
   Settings
   ------------------------------------------------------------------------- */

export async function saveSettings(form: FormData): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    const r = refused(error);
    if (r) return r;
    throw error;
  }

  const supabase = await createServerSupabase();
  const updates: { key: string; value: string }[] = [];

  for (const [field, value] of form.entries()) {
    if (!field.startsWith("setting.")) continue;
    updates.push({ key: field.slice("setting.".length), value: String(value).trim() });
  }

  for (const update of updates) {
    const { error } = await supabase
      .from("site_settings")
      .update({ value: update.value, updated_at: new Date().toISOString() })
      .eq("key", update.key);
    if (error) {
      return { ok: false, message: `Not all settings saved: ${error.message}`, fieldErrors: {} };
    }
  }

  // Records officer addresses live on the agency, since the Records Desk page
  // publishes them next to the office they belong to.
  for (const [field, value] of form.entries()) {
    if (!field.startsWith("agency.")) continue;
    const agencyId = field.slice("agency.".length);
    await supabase
      .from("agencies")
      .update({ records_officer_email: String(value).trim() || null })
      .eq("id", agencyId);
  }

  revalidateFor("settings");
  return {
    ok: true,
    message: `${updates.length} setting${updates.length === 1 ? "" : "s"} saved.`,
    fieldErrors: {},
  };
}

/* -------------------------------------------------------------------------
   Subscribers
   ------------------------------------------------------------------------- */

export type PublishNotice = {
  confirmedCount: number;
  items: { id: string; label: string; href: string }[];
};

/** What the confirmation dialog needs before anything is sent. */
export async function getPublishNoticeContext(): Promise<PublishNotice> {
  try {
    await requireAdminUser();
  } catch {
    return { confirmedCount: 0, items: [] };
  }

  const supabase = await createServerSupabase();
  const [{ count }, { data: reports }, { data: sessions }] = await Promise.all([
    supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("confirmed", true),
    supabase
      .from("reports")
      .select("id, title, slug, report_date")
      .eq("status", "published")
      .order("report_date", { ascending: false })
      .limit(20),
    supabase
      .from("listening_sessions")
      .select("id, session_date, audience")
      .eq("status", "published")
      .order("session_date", { ascending: false })
      .limit(20),
  ]);

  return {
    confirmedCount: count ?? 0,
    items: [
      ...(reports ?? []).map((r) => ({
        id: `report:${r.id}`,
        label: `Report: ${r.title}`,
        href: `/reports/${r.slug}`,
      })),
      ...(sessions ?? []).map((s) => ({
        id: `listening:${s.id}`,
        label: `Listening session, ${s.audience}, ${s.session_date}`,
        href: `/listening`,
      })),
    ],
  };
}

/**
 * Sends one notice about one published item, to confirmed subscribers only.
 *
 * Never called on a save. The copy doc promises one email when we publish, and
 * the only way to send it is for a person to press the button and confirm the
 * recipient count.
 */
export async function sendPublishNotice(itemId: string): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    const r = refused(error);
    if (r) return r;
    throw error;
  }

  const context = await getPublishNoticeContext();
  const item = context.items.find((i) => i.id === itemId);
  if (!item) {
    return { ok: false, message: "Choose something to tell subscribers about.", fieldErrors: {} };
  }

  const supabase = await createServerSupabase();
  const { data: subscribers } = await supabase
    .from("subscribers")
    .select("email")
    .eq("confirmed", true);

  const recipients = (subscribers ?? []).map((s) => s.email);
  if (recipients.length === 0) {
    return { ok: false, message: "Nobody has confirmed their email yet.", fieldErrors: {} };
  }

  const { html, text } = renderEmail({
    title: "We published something",
    body: [item.label, "It is free to read and share, and every number in it links to its source."],
    action: { label: "Read it", url: `${env.siteUrl}${item.href}` },
  });

  const result = await sendEmail({
    to: recipients,
    subject: "The Mona K Project published something",
    text,
    html,
  });

  if (!result.ok) return { ok: false, message: result.message, fieldErrors: {} };

  return {
    ok: true,
    message: result.local
      ? `Written to .local-storage/emails for ${result.recipients} confirmed subscriber(s). Set RESEND_API_KEY to send for real.`
      : `Notice sent to ${result.recipients} confirmed subscriber${result.recipients === 1 ? "" : "s"}.`,
    fieldErrors: {},
  };
}

/** Subscribers as CSV, for the admin to download. */
export async function exportSubscribers(): Promise<{ ok: boolean; csv: string; message: string }> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return { ok: false, csv: "", message: error.message };
    throw error;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, confirmed, created_at")
    .order("created_at", { ascending: true });

  if (error) return { ok: false, csv: "", message: `Could not export: ${error.message}` };

  const rows = [
    "email,confirmed,created_at",
    ...(data ?? []).map((s) => `${csvCell(s.email)},${s.confirmed},${s.created_at}`),
  ];
  return { ok: true, csv: rows.join("\n"), message: `${data?.length ?? 0} subscribers exported.` };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
