import { createPublicClient } from "@/lib/supabase/public";
import { env } from "@/lib/env";
import {
  isTemplate,
  type BallotIssue,
  type ContractEvent,
  type ContractEventType,
  type Explainer,
  type ExplainerCard,
  type ExplainerSource,
  type LevyFigures,
  type LevyKind,
  type Template,
} from "@/lib/explainer-types";

/** Today in Toledo, as YYYY-MM-DD. A ballot on today's date is still ahead. */
function todayInToledo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

/**
 * Whether a published explainer covers something still to be decided at the
 * ballot box. The home page leads with "See what's on the ballot" only then,
 * so the button never opens onto an empty or past election.
 */
export async function hasUpcomingBallotExplainer(): Promise<boolean> {
  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("explainers_public")
    .select("id", { count: "exact", head: true })
    .in("kind", ["ballot_issue", "levy"])
    .gte("decision_date", todayInToledo());
  if (error) throw new Error(`Could not check for ballot explainers: ${error.message}`);
  return (count ?? 0) > 0;
}

/** Public URL of a file in one of the two public explainer buckets. */
export function explainerFileUrl(bucket: "explainer-pdfs" | "explainer-images", path: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

// ---------------------------------------------------------------------------
// Snapshot parsing. The snapshot is jsonb written by build_explainer_snapshot()
// in 0011, so every field is read defensively: a version frozen before a
// field existed simply does not have it.
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function list(value: unknown): Json[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as Json[]) : [];
}

export function parseSnapshot(
  snapshot: unknown,
  meta: { updatedAt: string | null; version: number; changeNote: string | null },
): Explainer | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const root = snapshot as Json;
  const e = (root.explainer ?? {}) as Json;
  const template = e.template;
  if (!isTemplate(template)) return null;

  const sources: ExplainerSource[] = list(root.sources).map((s) => ({
    id: String(s.id),
    label: String(s.label ?? ""),
    url: String(s.url ?? ""),
    documentDate: str(s.document_date),
    note: str(s.note),
  }));

  const ballotIssues: BallotIssue[] = list(root.ballot_issues).map((b) => ({
    id: String(b.id),
    issueNumber: str(b.issue_number),
    title: String(b.title ?? ""),
    jurisdiction: str(b.jurisdiction),
    whatYesMeans: String(b.what_yes_means ?? ""),
    whatNoMeans: String(b.what_no_means ?? ""),
    costNote: str(b.cost_note),
    costSourceId: str(b.cost_source_id),
    linkedLevySlug: str(b.linked_levy_slug),
  }));

  const l = root.levy && typeof root.levy === "object" ? (root.levy as Json) : null;
  const levy: LevyFigures | null = l
    ? {
        districtOrBody: String(l.district_or_body ?? ""),
        levyKind: (str(l.levy_kind) ?? "new") as LevyKind,
        mills: num(l.mills),
        years: num(l.years),
        purpose: str(l.purpose),
        estimatedAnnualRevenue: num(l.estimated_annual_revenue),
        costPer100k: num(l.cost_per_100k),
        millsSourceId: str(l.mills_source_id),
        revenueSourceId: str(l.revenue_source_id),
        costSourceId: str(l.cost_source_id),
      }
    : null;

  const contractEvents: ContractEvent[] = list(root.contract_events).map((c) => ({
    id: String(c.id),
    eventDate: String(c.event_date ?? ""),
    eventType: (str(c.event_type) ?? "other") as ContractEventType,
    headline: String(c.headline ?? ""),
    description: str(c.description),
    sourceId: str(c.source_id),
  }));

  const pdfPath = str(e.pdf_path);
  const heroPath = str(e.hero_image_path);

  return {
    id: String(e.id),
    slug: String(e.slug),
    template,
    title: String(e.title ?? ""),
    summary: String(e.summary_30s ?? ""),
    oneSentence: str(e.one_sentence),
    decisionDate: str(e.decision_date),
    currentStatus: str(e.current_status),
    pdfUrl: pdfPath ? explainerFileUrl("explainer-pdfs", pdfPath) : null,
    heroImageUrl: heroPath ? explainerFileUrl("explainer-images", heroPath) : null,
    heroImageAlt: str(e.hero_image_alt),
    isSample: e.is_sample === true,
    updatedAt: meta.updatedAt,
    version: meta.version,
    changeNote: meta.changeNote,
    sources,
    ballotIssues,
    levy,
    contractEvents,
  };
}

// ---------------------------------------------------------------------------
// Public reads. Missing data is a state the site survives: a failed read is
// logged to the build output and the page renders empty, so one unapplied
// migration cannot take the rest of the site down with it.
// ---------------------------------------------------------------------------

export async function getPublishedExplainers(): Promise<ExplainerCard[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("explainers_public")
    .select("id, slug, template, title, one_sentence, summary_30s, decision_date, updated_at")
    .not("template", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(`Explainers could not be read, so none are shown: ${error.message}`);
    return [];
  }

  return (data ?? []).flatMap((row) =>
    isTemplate(row.template) && row.id && row.slug
      ? [
          {
            id: row.id,
            slug: row.slug,
            template: row.template,
            title: row.title ?? "",
            summary: row.one_sentence ?? row.summary_30s ?? "",
            decisionDate: row.decision_date,
            updatedAt: row.updated_at,
          },
        ]
      : [],
  );
}

export async function getLatestExplainers(limit: number): Promise<ExplainerCard[]> {
  return (await getPublishedExplainers()).slice(0, limit);
}

export async function getPublishedExplainer(template: Template, slug: string): Promise<Explainer | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("explainers_public")
    .select("snapshot, updated_at, version, change_note")
    .eq("template", template)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(`Explainer ${template}/${slug} could not be read: ${error.message}`);
    return null;
  }
  if (!data) return null;

  return parseSnapshot(data.snapshot, {
    updatedAt: data.updated_at,
    version: data.version ?? 1,
    changeNote: data.change_note,
  });
}

/** Slugs of published levy pages, so a ballot card only links to one that exists. */
export async function getPublishedLevySlugs(): Promise<Set<string>> {
  return new Set(
    (await getPublishedExplainers()).filter((e) => e.template === "levy").map((e) => e.slug),
  );
}
