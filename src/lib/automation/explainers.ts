import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { slugify } from "@/lib/slug";
import { TEMPLATE_KIND, type ContractEventType, type Template } from "@/lib/explainer-types";

/**
 * Where the AI drafting code (phase 8, not built yet) writes explainers.
 *
 * Everything here is a draft. Explainers are created with ai_draft = true,
 * so they carry the amber "AI draft, unreviewed" badge in the admin and are
 * excluded from explainers_public even if their status were changed. Contract
 * events are flagged ai_generated. Nothing here can publish, and the database
 * would refuse if it tried: publish_explainer() requires a signed in admin,
 * and forbid_automation_publish() stops the service role writing a published
 * row. A person reads it, saves it, and publishes it.
 *
 * Both functions do nothing unless AUTOMATION_ENABLED is "true".
 */

export class AutomationDisabledError extends Error {
  constructor() {
    super("AUTOMATION_ENABLED is not \"true\", so automation may not write.");
    this.name = "AutomationDisabledError";
  }
}

function requireAutomation() {
  if (!env.automationEnabled) throw new AutomationDisabledError();
}

export async function draftExplainer(input: {
  template: Template;
  title: string;
  summary?: string;
  decisionDate?: string;
}): Promise<string> {
  requireAutomation();
  const supabase = createServiceClient();
  const slug = `${slugify(input.title) || input.template}-draft-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from("explainers")
    .insert({
      slug,
      title: input.title,
      template: input.template,
      kind: TEMPLATE_KIND[input.template],
      summary_30s: input.summary ?? null,
      decision_date: input.decisionDate ?? null,
      status: "draft",
      ai_draft: true,
      stage: "ai_draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not draft the explainer: ${error?.message}`);

  if (input.template === "levy") {
    await supabase.from("levy_details").insert({ explainer_id: data.id });
  }
  return data.id;
}

/**
 * Adds an event to a contract tracker. It appears on the public page only
 * after a person publishes the tracker again.
 */
export async function draftContractEvent(input: {
  explainerId: string;
  eventDate: string;
  eventType: ContractEventType;
  headline: string;
  description?: string;
  source?: { label: string; url: string; documentDate?: string };
}): Promise<string> {
  requireAutomation();
  const supabase = createServiceClient();

  let sourceId: string | null = null;
  if (input.source) {
    const { data, error } = await supabase
      .from("explainer_sources")
      .insert({
        explainer_id: input.explainerId,
        label: input.source.label,
        url: input.source.url,
        document_date: input.source.documentDate ?? null,
        note: "Added by automation. Check before publishing.",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Could not add the source: ${error?.message}`);
    sourceId = data.id;
  }

  const { data, error } = await supabase
    .from("contract_events")
    .insert({
      explainer_id: input.explainerId,
      event_date: input.eventDate,
      event_type: input.eventType,
      headline: input.headline,
      description: input.description ?? null,
      source_id: sourceId,
      ai_generated: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not draft the event: ${error?.message}`);
  return data.id;
}
