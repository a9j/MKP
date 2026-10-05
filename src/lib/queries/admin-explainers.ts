import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseSnapshot } from "@/lib/queries/explainers";
import { isTemplate, type Explainer, type Template } from "@/lib/explainer-types";

/**
 * Admin reads for the explainer screens. All of them go through the signed in
 * admin's own session, so RLS decides what comes back, the same as every
 * other admin screen.
 */

export type AdminExplainerRow = {
  id: string;
  slug: string;
  template: Template;
  title: string;
  status: "draft" | "published";
  version: number;
  isSample: boolean;
  aiDraft: boolean;
  updatedAt: string;
  lastPublishedAt: string | null;
};

export async function listAdminExplainers(): Promise<AdminExplainerRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("explainers")
    .select("id, slug, template, title, status, version, is_sample, ai_draft, updated_at, last_published_at")
    .not("template", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not list explainers: ${error.message}`);

  return (data ?? []).flatMap((row) =>
    isTemplate(row.template)
      ? [
          {
            id: row.id,
            slug: row.slug,
            template: row.template,
            title: row.title,
            status: row.status,
            version: row.version,
            isSample: row.is_sample,
            aiDraft: row.ai_draft,
            updatedAt: row.updated_at,
            lastPublishedAt: row.last_published_at,
          },
        ]
      : [],
  );
}

/** Everything the editor needs, straight from the working tables. */
export async function getAdminExplainer(id: string) {
  const supabase = await createServerSupabase();
  const { data: explainer, error } = await supabase
    .from("explainers")
    .select(
      "id, slug, template, title, one_sentence, summary_30s, decision_date, current_status, pdf_path, hero_image_path, hero_image_alt, status, version, is_sample, ai_draft, reading_grade, updated_at, last_published_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the explainer: ${error.message}`);
  if (!explainer || !isTemplate(explainer.template)) return null;

  const [sources, issues, levy, events, problems, levyOptions] = await Promise.all([
    supabase
      .from("explainer_sources")
      .select("id, label, url, document_date, note, sort_order")
      .eq("explainer_id", id)
      .order("sort_order"),
    supabase
      .from("ballot_issues")
      .select(
        "id, issue_number, title, jurisdiction, what_yes_means, what_no_means, cost_note, cost_source_id, linked_levy_explainer_id, sort_order",
      )
      .eq("explainer_id", id)
      .order("sort_order"),
    supabase.from("levy_details").select("*").eq("explainer_id", id).maybeSingle(),
    supabase
      .from("contract_events")
      .select("id, event_date, event_type, headline, description, source_id, ai_generated, sort_order")
      .eq("explainer_id", id)
      .order("event_date", { ascending: false })
      .order("sort_order"),
    supabase.rpc("explainer_problems", { p_id: id }),
    supabase
      .from("explainers")
      .select("id, title, is_sample")
      .eq("template", "levy")
      .neq("id", id)
      .order("title"),
  ]);

  return {
    explainer: { ...explainer, template: explainer.template },
    sources: sources.data ?? [],
    issues: issues.data ?? [],
    levy: levy.data ?? null,
    events: events.data ?? [],
    problems: problems.data ?? [],
    levyOptions: levyOptions.data ?? [],
  };
}

export type AdminExplainer = NonNullable<Awaited<ReturnType<typeof getAdminExplainer>>>;

/**
 * The page as it would look if published now. Built by the same
 * build_explainer_snapshot() that publishing freezes, through the admin's
 * session, so the preview cannot show anything publishing would not.
 */
export async function getExplainerPreview(id: string): Promise<{
  explainer: Explainer;
  status: "draft" | "published";
  problems: string[];
} | null> {
  const supabase = await createServerSupabase();
  const [{ data: row }, { data: snapshot, error }, { data: problems }] = await Promise.all([
    supabase.from("explainers").select("status, version").eq("id", id).maybeSingle(),
    supabase.rpc("build_explainer_snapshot", { p_id: id }),
    supabase.rpc("explainer_problems", { p_id: id }),
  ]);
  if (error || !row || !snapshot) return null;

  const explainer = parseSnapshot(snapshot, { updatedAt: null, version: row.version + 1, changeNote: null });
  if (!explainer) return null;
  return { explainer, status: row.status, problems: problems ?? [] };
}
