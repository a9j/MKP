"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import { slugify } from "@/lib/slug";
import { readingGrade } from "@/lib/reading-grade";
import { MAX_DOCUMENT_BYTES } from "@/lib/limits";
import {
  CONTRACT_EVENT_LABEL,
  LEVY_KIND_LABEL,
  TEMPLATE_KIND,
  explainerPath,
  isTemplate,
  type ContractEventType,
  type LevyKind,
  type Template,
} from "@/lib/explainer-types";
import type { ExplainerPayload } from "@/lib/explainer-payload";

export type ExplainerResult = {
  ok: boolean;
  message: string;
  fieldErrors: Record<string, string>;
  problems?: string[];
  id?: string;
  version?: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HTTP_URL = /^https?:\/\/\S+$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fail(message: string, fieldErrors: Record<string, string> = {}): ExplainerResult {
  return { ok: false, message, fieldErrors };
}

async function asAdmin(): Promise<ExplainerResult | null> {
  try {
    await requireAdminUser();
    return null;
  } catch (error) {
    if (error instanceof NotAnAdminError) return fail(error.message);
    throw error;
  }
}

/** A number typed into a form: "2.5", "$1,200,000", "". Null when blank. */
function money(value: string): number | null | "bad" {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : "bad";
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
}

/** The plain-language text a reader sees, for the reading grade. Titles are names, not prose. */
function readableText(p: ExplainerPayload): string {
  return [
    p.summary,
    p.oneSentence,
    p.currentStatus,
    ...p.issues.flatMap((i) => [i.whatYesMeans, i.whatNoMeans, i.costNote]),
    p.levy?.purpose,
    ...p.events.map((e) => e.description),
  ]
    .filter((t): t is string => Boolean(t && t.trim()))
    .map((t) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createExplainer(form: FormData): Promise<ExplainerResult> {
  const denied = await asAdmin();
  if (denied) return denied;

  const template = String(form.get("template") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!isTemplate(template)) return fail("Pick a type.", { template: "Pick a type." });
  if (title.length === 0) return fail("Give it a title.", { title: "Give it a title." });

  const supabase = await createServerSupabase();
  const base = slugify(title) || template;

  // A new explainer takes the first free address, so a second "Levy" does not
  // fail on the first one's slug. It can be changed in the editor.
  const { data: taken } = await supabase.from("explainers").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((r) => r.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await supabase
    .from("explainers")
    .insert({ slug, title, template, kind: TEMPLATE_KIND[template] })
    .select("id")
    .single();
  if (error || !data) return fail(`Nothing was saved: ${error?.message}`);

  if (template === "levy") {
    await supabase.from("levy_details").insert({ explainer_id: data.id });
  }

  return { ok: true, message: "Explainer created.", fieldErrors: {}, id: data.id };
}

// ---------------------------------------------------------------------------
// Save: the whole editor in one request
// ---------------------------------------------------------------------------

function validate(p: ExplainerPayload, template: Template): Record<string, string> {
  const errors: Record<string, string> = {};
  const len = (v: string | null | undefined) => (v ?? "").trim().length;

  if (len(p.title) === 0) errors.title = "Give it a title.";
  if (len(p.slug) > 0 && slugify(p.slug) !== p.slug.trim()) {
    errors.slug = `Use lowercase letters, numbers and dashes, for example "${slugify(p.slug) || "november-levy"}".`;
  }
  if (len(p.summary) > 900) errors.summary = `${len(p.summary)} characters. The limit is 900.`;
  if (len(p.oneSentence) > 280) errors.oneSentence = `${len(p.oneSentence)} characters. The limit is 280.`;
  if (p.decisionDate && !ISO_DATE.test(p.decisionDate)) errors.decisionDate = "Give a date.";
  if (len(p.currentStatus) > 140) errors.currentStatus = `${len(p.currentStatus)} characters. The limit is 140.`;

  p.sources.forEach((s, i) => {
    if (len(s.label) === 0) errors[`source.${i}.label`] = "Give the source a label.";
    if (!HTTP_URL.test(s.url.trim())) errors[`source.${i}.url`] = "Give a link starting with http:// or https://.";
    if (s.documentDate && !ISO_DATE.test(s.documentDate)) errors[`source.${i}.documentDate`] = "Give a date.";
  });

  if (template === "ballot") {
    p.issues.forEach((issue, i) => {
      if (len(issue.title) === 0) errors[`issue.${i}.title`] = "Give the issue a title.";
    });
  }

  if (template === "levy" && p.levy) {
    const l = p.levy;
    if (!(l.levyKind in LEVY_KIND_LABEL)) errors["levy.levyKind"] = "Pick a kind of levy.";
    const mills = money(l.mills);
    if (mills === "bad" || mills === 0) errors["levy.mills"] = "Give the millage as a number, like 2.5.";
    if (l.years.trim() && !/^\d{1,2}$/.test(l.years.trim())) errors["levy.years"] = "Give whole years, or leave blank for continuing.";
    if (money(l.estimatedAnnualRevenue) === "bad") errors["levy.estimatedAnnualRevenue"] = "Give a dollar amount.";
    if (money(l.costPer100k) === "bad") errors["levy.costPer100k"] = "Give a dollar amount.";
  }

  if (template === "contract") {
    p.events.forEach((e, i) => {
      if (!ISO_DATE.test(e.eventDate)) errors[`event.${i}.eventDate`] = "Give a date.";
      if (!(e.eventType in CONTRACT_EVENT_LABEL)) errors[`event.${i}.eventType`] = "Pick a type.";
      if (len(e.headline) === 0) errors[`event.${i}.headline`] = "Give a headline.";
      if (len(e.headline) > 140) errors[`event.${i}.headline`] = "Keep the headline under 140 characters.";
    });
  }

  return errors;
}

export async function saveExplainer(form: FormData): Promise<ExplainerResult> {
  const denied = await asAdmin();
  if (denied) return denied;

  let p: ExplainerPayload;
  try {
    p = JSON.parse(String(form.get("payload") ?? "")) as ExplainerPayload;
  } catch {
    return fail("The form could not be read. Reload the page and try again.");
  }

  const supabase = await createServerSupabase();
  const { data: current } = await supabase
    .from("explainers")
    .select("id, template, slug, version")
    .eq("id", p.id)
    .maybeSingle();
  if (!current || !isTemplate(current.template)) return fail("That explainer no longer exists.");
  const template = current.template;

  const fieldErrors = validate(p, template);

  const pdf = form.get("pdf");
  const pdfFile = pdf instanceof File && pdf.size > 0 ? pdf : null;
  if (pdfFile) {
    if (pdfFile.type !== "application/pdf" && !pdfFile.name.toLowerCase().endsWith(".pdf")) {
      fieldErrors.pdf = `${pdfFile.name} is not a PDF.`;
    } else if (pdfFile.size > MAX_DOCUMENT_BYTES) {
      fieldErrors.pdf = `${pdfFile.name} is larger than 25MB.`;
    }
  }
  const hero = form.get("heroImage");
  const heroFile = hero instanceof File && hero.size > 0 ? hero : null;
  if (heroFile) {
    if (!IMAGE_TYPES.includes(heroFile.type)) fieldErrors.heroImage = "Use a JPEG, PNG or WebP image.";
    else if (heroFile.size > MAX_IMAGE_BYTES) fieldErrors.heroImage = "Keep the image under 5MB.";
  }
  const willHaveHero = (heroFile !== null || (p.heroImagePath !== null && !p.removeHeroImage));
  if (willHaveHero && !(p.heroImageAlt ?? "").trim()) {
    fieldErrors.heroImageAlt = "Describe the photo for someone who cannot see it.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Nothing was saved. Check the fields marked below.", fieldErrors);
  }

  // Files first, so a failed upload leaves the rest untouched.
  let pdfPath: string | null | undefined;
  if (pdfFile) {
    const path = `${p.id}/${Date.now()}-${safeName(pdfFile.name)}`;
    const { error } = await supabase.storage
      .from("explainer-pdfs")
      .upload(path, pdfFile, { contentType: "application/pdf", upsert: false });
    if (error) return fail(`Nothing was saved. The PDF did not upload: ${error.message}`);
    pdfPath = path;
  } else if (p.removePdf) {
    pdfPath = null;
  }

  let heroPath: string | null | undefined;
  if (heroFile) {
    const path = `${p.id}/${Date.now()}-${safeName(heroFile.name)}`;
    const { error } = await supabase.storage
      .from("explainer-images")
      .upload(path, heroFile, { contentType: heroFile.type, upsert: false });
    if (error) return fail(`Nothing was saved. The image did not upload: ${error.message}`);
    heroPath = path;
  } else if (p.removeHeroImage) {
    heroPath = null;
  }
  // Old files are never deleted: a published version may still point at one,
  // and its page has to keep working until the next publish.

  const slug = p.slug.trim() || slugify(p.title) || current.slug;
  const grade = readingGrade(readableText(p));

  const { error: rowError } = await supabase
    .from("explainers")
    .update({
      title: p.title.trim(),
      slug,
      summary_30s: p.summary.trim() || null,
      one_sentence: (p.oneSentence ?? "").trim() || null,
      decision_date: p.decisionDate || null,
      current_status: (p.currentStatus ?? "").trim() || null,
      hero_image_alt: willHaveHero ? (p.heroImageAlt ?? "").trim() : null,
      reading_grade: grade,
      ...(pdfPath !== undefined ? { pdf_path: pdfPath } : {}),
      ...(heroPath !== undefined ? { hero_image_path: heroPath } : {}),
      // Saving by hand is a person reading it, so it is no longer an
      // unreviewed machine draft.
      ai_draft: false,
    })
    .eq("id", p.id);
  if (rowError) {
    return rowError.code === "23505"
      ? fail(`Another explainer already uses the address "${slug}".`, { slug: "Already in use." })
      : fail(`Nothing was saved: ${rowError.message}`);
  }

  // Sources are updated in place rather than replaced, because figures point
  // at them by id. A source removed here clears any figure that cited it.
  const keyToId = new Map<string, string>();
  const keptIds = p.sources.map((s) => s.id).filter((id): id is string => Boolean(id));
  {
    let query = supabase.from("explainer_sources").delete().eq("explainer_id", p.id);
    if (keptIds.length) query = query.not("id", "in", `(${keptIds.join(",")})`);
    const { error } = await query;
    if (error) return fail(`Saved the basics, but the sources failed: ${error.message}`);
  }
  for (const [i, s] of p.sources.entries()) {
    const row = {
      explainer_id: p.id,
      label: s.label.trim(),
      url: s.url.trim(),
      document_date: s.documentDate || null,
      note: (s.note ?? "").trim() || null,
      sort_order: i,
    };
    if (s.id) {
      const { error } = await supabase.from("explainer_sources").update(row).eq("id", s.id);
      if (error) return fail(`Saved the basics, but a source failed: ${error.message}`);
      keyToId.set(s.key, s.id);
    } else {
      const { data, error } = await supabase.from("explainer_sources").insert(row).select("id").single();
      if (error || !data) return fail(`Saved the basics, but a source failed: ${error?.message}`);
      keyToId.set(s.key, data.id);
    }
  }
  const sourceId = (key: string | null | undefined) => (key ? keyToId.get(key) ?? null : null);

  if (template === "ballot") {
    const kept = p.issues.map((i) => i.id).filter((id): id is string => Boolean(id));
    let del = supabase.from("ballot_issues").delete().eq("explainer_id", p.id);
    if (kept.length) del = del.not("id", "in", `(${kept.join(",")})`);
    const { error: delError } = await del;
    if (delError) return fail(`Saved, but the issues failed: ${delError.message}`);

    for (const [i, issue] of p.issues.entries()) {
      const row = {
        explainer_id: p.id,
        issue_number: (issue.issueNumber ?? "").trim() || null,
        title: issue.title.trim(),
        jurisdiction: (issue.jurisdiction ?? "").trim() || null,
        what_yes_means: issue.whatYesMeans.trim(),
        what_no_means: issue.whatNoMeans.trim(),
        cost_note: (issue.costNote ?? "").trim() || null,
        cost_source_id: sourceId(issue.costSourceKey),
        linked_levy_explainer_id: issue.linkedLevyId || null,
        sort_order: i,
      };
      const { error } = issue.id
        ? await supabase.from("ballot_issues").update(row).eq("id", issue.id)
        : await supabase.from("ballot_issues").insert(row);
      if (error) return fail(`Saved, but issue ${i + 1} failed: ${error.message}`);
    }
  }

  if (template === "levy" && p.levy) {
    const l = p.levy;
    const asNumber = (v: string) => {
      const n = money(v);
      return n === "bad" ? null : n;
    };
    const { error } = await supabase.from("levy_details").upsert({
      explainer_id: p.id,
      district_or_body: l.districtOrBody.trim(),
      levy_kind: l.levyKind as LevyKind,
      mills: asNumber(l.mills),
      years: l.years.trim() ? Number(l.years.trim()) : null,
      purpose: (l.purpose ?? "").trim() || null,
      estimated_annual_revenue: asNumber(l.estimatedAnnualRevenue),
      cost_per_100k: asNumber(l.costPer100k),
      mills_source_id: sourceId(l.millsSourceKey),
      revenue_source_id: sourceId(l.revenueSourceKey),
      cost_source_id: sourceId(l.costSourceKey),
    });
    if (error) return fail(`Saved, but the levy figures failed: ${error.message}`);
  }

  if (template === "contract") {
    const kept = p.events.map((e) => e.id).filter((id): id is string => Boolean(id));
    let del = supabase.from("contract_events").delete().eq("explainer_id", p.id);
    if (kept.length) del = del.not("id", "in", `(${kept.join(",")})`);
    const { error: delError } = await del;
    if (delError) return fail(`Saved, but the timeline failed: ${delError.message}`);

    for (const [i, e] of p.events.entries()) {
      const row = {
        explainer_id: p.id,
        event_date: e.eventDate,
        event_type: e.eventType as ContractEventType,
        headline: e.headline.trim(),
        description: (e.description ?? "").trim() || null,
        source_id: sourceId(e.sourceKey),
        sort_order: i,
      };
      const { error } = e.id
        ? await supabase.from("contract_events").update(row).eq("id", e.id)
        : await supabase.from("contract_events").insert(row);
      if (error) return fail(`Saved, but update ${i + 1} failed: ${error.message}`);
    }
  }

  const { data: problems } = await supabase.rpc("explainer_problems", { p_id: p.id });

  return {
    ok: true,
    message: "Saved.",
    fieldErrors: {},
    problems: problems ?? [],
    id: p.id,
    version: current.version,
  };
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

async function publish(id: string, changeNote: string | null): Promise<ExplainerResult> {
  const supabase = await createServerSupabase();
  const { data: version, error } = await supabase.rpc("publish_explainer", {
    p_id: id,
    p_change_note: changeNote ?? undefined,
  });
  if (error) {
    const { data: problems } = await supabase.rpc("explainer_problems", { p_id: id });
    return {
      ok: false,
      message: error.message.replace(/^Cannot publish\. /, "Not published yet. "),
      fieldErrors: error.message.includes("change note") ? { changeNote: "Say what changed." } : {},
      problems: problems ?? [],
    };
  }

  const { data: row } = await supabase.from("explainers").select("template, slug").eq("id", id).maybeSingle();
  if (row && isTemplate(row.template)) {
    revalidateFor("explainer", [explainerPath(row.template, row.slug)]);
    // A ballot card links to its levy page only once that page is live.
    if (row.template === "levy") revalidatePath("/ballot/[slug]", "page");
  }

  return {
    ok: true,
    message: version === 1 ? "Published. The page is live." : `Published version ${version}. The page is updated.`,
    fieldErrors: {},
    problems: [],
    id,
    version: version ?? undefined,
  };
}

export async function publishExplainer(id: string, changeNote: string): Promise<ExplainerResult> {
  const denied = await asAdmin();
  if (denied) return denied;
  return publish(id, changeNote.trim() || null);
}

// ---------------------------------------------------------------------------
// The contract tracker's quick update
// ---------------------------------------------------------------------------

export async function addContractUpdate(form: FormData): Promise<ExplainerResult> {
  const denied = await asAdmin();
  if (denied) return denied;

  const explainerId = String(form.get("explainerId") ?? "");
  const eventDate = String(form.get("eventDate") ?? "");
  const eventType = String(form.get("eventType") ?? "");
  const headline = String(form.get("headline") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const existingSource = String(form.get("sourceId") ?? "");
  const newLabel = String(form.get("newSourceLabel") ?? "").trim();
  const newUrl = String(form.get("newSourceUrl") ?? "").trim();
  const publishNow = form.get("publishNow") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!ISO_DATE.test(eventDate)) fieldErrors.eventDate = "Give a date.";
  if (!(eventType in CONTRACT_EVENT_LABEL)) fieldErrors.eventType = "Pick a type.";
  if (headline.length === 0) fieldErrors.headline = "Give a headline.";
  if (headline.length > 140) fieldErrors.headline = "Keep the headline under 140 characters.";
  if (existingSource === "new") {
    if (newLabel.length === 0) fieldErrors.newSourceLabel = "Name the document.";
    if (!HTTP_URL.test(newUrl)) fieldErrors.newSourceUrl = "Give a link starting with http:// or https://.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail("Nothing was added. Check the fields marked below.", fieldErrors);
  }

  const supabase = await createServerSupabase();

  let sourceId: string | null = existingSource && existingSource !== "new" ? existingSource : null;
  if (existingSource === "new") {
    const { count } = await supabase
      .from("explainer_sources")
      .select("id", { count: "exact", head: true })
      .eq("explainer_id", explainerId);
    const { data, error } = await supabase
      .from("explainer_sources")
      .insert({ explainer_id: explainerId, label: newLabel, url: newUrl, document_date: eventDate, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error || !data) return fail(`Nothing was added: ${error?.message}`);
    sourceId = data.id;
  }

  const { error } = await supabase.from("contract_events").insert({
    explainer_id: explainerId,
    event_date: eventDate,
    event_type: eventType as ContractEventType,
    headline,
    description: description || null,
    source_id: sourceId,
  });
  if (error) return fail(`Nothing was added: ${error.message}`);

  // The new event counts toward the reading grade and touches the row, so
  // the list shows it as the latest change.
  const { data: all } = await supabase
    .from("contract_events")
    .select("description")
    .eq("explainer_id", explainerId);
  const { data: row } = await supabase
    .from("explainers")
    .select("summary_30s, one_sentence, current_status, version")
    .eq("id", explainerId)
    .maybeSingle();
  if (row) {
    const text = [row.summary_30s, row.one_sentence, row.current_status, ...(all ?? []).map((e) => e.description)]
      .filter((t): t is string => Boolean(t && t.trim()))
      .map((t) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`))
      .join("\n");
    await supabase.from("explainers").update({ reading_grade: readingGrade(text) }).eq("id", explainerId);
  }

  if (!publishNow) {
    return { ok: true, message: "Update added. Publish when you are ready.", fieldErrors: {}, id: explainerId };
  }

  const published = await publish(explainerId, (row?.version ?? 0) >= 1 ? `New update: ${headline}` : null);
  return published.ok
    ? { ...published, message: `Update added and published.` }
    : { ...published, message: `Update added, but not published. ${published.message}` };
}

// ---------------------------------------------------------------------------
// Delete. Only something that was never published: a published explainer has
// readers and a version history, and corrections may point at it.
// ---------------------------------------------------------------------------

export async function deleteExplainer(id: string): Promise<ExplainerResult> {
  const denied = await asAdmin();
  if (denied) return denied;

  const supabase = await createServerSupabase();
  const { data: row } = await supabase.from("explainers").select("version").eq("id", id).maybeSingle();
  if (!row) return fail("That explainer no longer exists.");
  if (row.version > 0) return fail("A published explainer cannot be deleted. Correct it and publish again.");

  const { error } = await supabase.from("explainers").delete().eq("id", id);
  if (error) return fail(`Nothing was deleted: ${error.message}`);
  return { ok: true, message: "Deleted.", fieldErrors: {} };
}
