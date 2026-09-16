"use server";

import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import { SUMMARY_MAX } from "@/lib/limits";

export type VoteChoice = "yes" | "no" | "abstain" | "absent";

export type NewVote = {
  bodyId: string;
  meetingDate: string;
  itemTitle: string;
  summary: string;
  category: "money" | "staffing" | "contracts" | "facilities" | "other";
  amount: string;
  agendaUrl: string;
  minutesUrl: string;
  rollCall: { personId: string; vote: VoteChoice }[];
};

export type SaveResult = { ok: boolean; message: string; fieldErrors: Record<string, string> };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(vote: NewVote): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!vote.bodyId) errors.bodyId = "Choose which body voted.";
  if (!ISO_DATE.test(vote.meetingDate)) errors.meetingDate = "Give the meeting date.";
  if (vote.itemTitle.trim().length === 0) errors.itemTitle = "Give the agenda item title.";

  const summary = vote.summary.trim();
  if (summary.length === 0) {
    errors.summary = "Write one sentence describing what was decided.";
  } else if (summary.length > SUMMARY_MAX) {
    // The database enforces this too. Catching it here means a clear message
    // rather than a constraint violation.
    errors.summary = `${summary.length} characters. The limit is ${SUMMARY_MAX}.`;
  }

  if (vote.amount.trim().length > 0) {
    const amount = Number(vote.amount.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      errors.amount = "The amount must be a positive number, or left empty.";
    }
  }

  for (const [field, value] of [
    ["agendaUrl", vote.agendaUrl],
    ["minutesUrl", vote.minutesUrl],
  ] as const) {
    if (value.trim().length > 0 && !/^https?:\/\/\S+$/i.test(value.trim())) {
      errors[field] = "Give a link starting with http:// or https://.";
    }
  }

  if (vote.rollCall.length === 0) {
    errors.rollCall = "This body has no active members recorded yet. Add them under People first.";
  }

  return errors;
}

export async function createVote(vote: NewVote): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) {
      return { ok: false, message: error.message, fieldErrors: {} };
    }
    throw error;
  }

  const fieldErrors = validate(vote);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was published. Check the fields marked below.", fieldErrors };
  }

  const tally = {
    yes_count: vote.rollCall.filter((r) => r.vote === "yes").length,
    no_count: vote.rollCall.filter((r) => r.vote === "no").length,
    abstain_count: vote.rollCall.filter((r) => r.vote === "abstain").length,
    absent_count: vote.rollCall.filter((r) => r.vote === "absent").length,
  };

  const supabase = await createServerSupabase();

  const { data: inserted, error } = await supabase
    .from("votes")
    .insert({
      body_id: vote.bodyId,
      meeting_date: vote.meetingDate,
      item_title: vote.itemTitle.trim(),
      summary: vote.summary.trim(),
      category: vote.category,
      amount: vote.amount.trim().length > 0 ? Number(vote.amount.replace(/[$,\s]/g, "")) : null,
      agenda_url: vote.agendaUrl.trim() || null,
      minutes_url: vote.minutesUrl.trim() || null,
      ...tally,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, message: `Nothing was published: ${error?.message}`, fieldErrors: {} };
  }

  const { error: membersError } = await supabase.from("vote_members").insert(
    vote.rollCall.map((r) => ({ vote_id: inserted.id, person_id: r.personId, vote: r.vote })),
  );

  if (membersError) {
    // Without the roll call the vote would publish with a tally nobody can
    // check, so the vote itself is removed rather than left half recorded.
    await supabase.from("votes").delete().eq("id", inserted.id);
    return {
      ok: false,
      message: `Nothing was published: the roll call could not be saved. ${membersError.message}`,
      fieldErrors: {},
    };
  }

  revalidateFor("vote");
  return { ok: true, message: "Vote published.", fieldErrors: {} };
}

/** Active members of a body, in the order they should appear on the roll call. */
export async function getRollCallMembers(bodyId: string) {
  try {
    await requireAdminUser();
  } catch {
    return [];
  }
  if (!bodyId) return [];

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("people")
    .select("id, name, title")
    .eq("body_id", bodyId)
    .eq("role", "body_member")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return data ?? [];
}
