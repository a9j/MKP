import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { VoteForm, type EditableVote } from "@/components/admin/vote-form";
import { getBodiesByMemberCount, getMeetingOptions } from "@/lib/queries/admin-votes";
import type { VoteChoice } from "@/lib/actions/votes";

export const dynamic = "force-dynamic";

export default async function AdminVoteDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Review a draft</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const [bodies, meetings, { data: vote }] = await Promise.all([
    getBodiesByMemberCount(),
    getMeetingOptions(),
    supabase
      .from("votes")
      .select(
        "id, meeting_id, item_title, summary, category, amount, agenda_item_url, status, ai_draft, ai_model, ai_confidence, vote_members(person_id, vote)",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!vote) notFound();

  const draft: EditableVote = {
    id: vote.id,
    meetingId: vote.meeting_id,
    itemTitle: vote.item_title,
    summary: vote.summary,
    category: vote.category,
    amount: vote.amount === null ? "" : String(vote.amount),
    agendaItemUrl: vote.agenda_item_url ?? "",
    aiDraft: vote.ai_draft,
    aiModel: vote.ai_model,
    aiConfidence: vote.ai_confidence === null ? null : Number(vote.ai_confidence),
    rollCall: Object.fromEntries(
      (vote.vote_members ?? []).map((m) => [m.person_id, m.vote as VoteChoice]),
    ),
  };

  return (
    <>
      <h1>{vote.status === "draft" ? "Review a draft" : "Edit a vote"}</h1>
      <p className="admin-help">
        <Link href="/admin/votes">Back to votes</Link>
      </p>

      <section className="uploader">
        <VoteForm bodies={bodies} meetings={meetings} draft={draft} />
      </section>
    </>
  );
}
