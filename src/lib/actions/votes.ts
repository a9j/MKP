"use server";

import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import { SUMMARY_MAX } from "@/lib/limits";

export type VoteChoice = "yes" | "no" | "abstain" | "absent";
export type MeetingKind = "regular" | "special";

export type NewMeeting = {
  bodyId: string;
  meetingDate: string;
  kind: MeetingKind;
  agendaUrl: string;
  minutesUrl: string;
  videoUrl: string;
};

export type NewVote = {
  /** Set when an existing draft is being edited, absent when creating. */
  id?: string;
  meetingId: string;
  itemTitle: string;
  summary: string;
  category: "money" | "staffing" | "contracts" | "facilities" | "other";
  amount: string;
  agendaItemUrl: string;
  rollCall: { personId: string; vote: VoteChoice }[];
  /** False saves a draft. Only a person pressing Publish ever sets this true. */
  publish: boolean;
  /**
   * Set when the admin has tapped "I checked this against the document" on a
   * machine written draft. Nothing a model drafted publishes without it.
   */
  confirmedAgainstSource?: boolean;
};

export type SaveResult = { ok: boolean; message: string; fieldErrors: Record<string, string> };
export type MeetingResult = SaveResult & { meetingId?: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LINK = /^https?:\/\/\S+$/i;

function linkErrors(
  fields: readonly (readonly [string, string])[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [field, value] of fields) {
    if (value.trim().length > 0 && !LINK.test(value.trim())) {
      errors[field] = "Give a link starting with http:// or https://.";
    }
  }
  return errors;
}

function validate(vote: NewVote): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!vote.meetingId) errors.meetingId = "Choose the meeting this vote was taken at.";
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

  Object.assign(errors, linkErrors([["agendaItemUrl", vote.agendaItemUrl]]));

  // A draft may be saved before the minutes are out and the roll call is
  // known. Publishing a tally nobody can check is the thing to prevent.
  if (vote.publish && vote.rollCall.length === 0) {
    errors.rollCall = "This body has no active members recorded yet. Add them under People first.";
  }

  return errors;
}

/** The id of the signed in admin, for the review trail on a published vote. */
async function reviewerId(): Promise<string | null> {
  const admin = await requireAdminUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("admins").select("id").ilike("email", admin.email).maybeSingle();
  return data?.id ?? null;
}

export async function createMeeting(meeting: NewMeeting): Promise<MeetingResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return { ok: false, message: error.message, fieldErrors: {} };
    throw error;
  }

  const fieldErrors: Record<string, string> = {};
  if (!meeting.bodyId) fieldErrors.bodyId = "Choose which body met.";
  if (!ISO_DATE.test(meeting.meetingDate)) fieldErrors.meetingDate = "Give the meeting date.";
  Object.assign(
    fieldErrors,
    linkErrors([
      ["agendaUrl", meeting.agendaUrl],
      ["minutesUrl", meeting.minutesUrl],
      ["videoUrl", meeting.videoUrl],
    ]),
  );

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Nothing was saved. Check the fields marked below.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      body_id: meeting.bodyId,
      meeting_date: meeting.meetingDate,
      kind: meeting.kind,
      agenda_url: meeting.agendaUrl.trim() || null,
      minutes_url: meeting.minutesUrl.trim() || null,
      video_url: meeting.videoUrl.trim() || null,
      discovered_by: "admin",
    })
    .select("id")
    .single();

  if (error || !data) {
    // One body holds one meeting of a kind per day, so a repeat is almost
    // always the same meeting entered twice rather than a real conflict.
    const duplicate = error?.code === "23505";
    return {
      ok: false,
      message: duplicate
        ? "That meeting is already on the list. Choose it from the meeting field."
        : `Nothing was saved: ${error?.message}`,
      fieldErrors: {},
    };
  }

  revalidateFor("vote");
  return { ok: true, message: "Meeting added.", fieldErrors: {}, meetingId: data.id };
}

/**
 * Saves a vote as a draft, or publishes it.
 *
 * Publishing is the only operation here a machine cannot perform: the database
 * refuses a published row from the service role, so this path exists only for
 * a signed in person.
 */
export async function saveVote(vote: NewVote): Promise<SaveResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return { ok: false, message: error.message, fieldErrors: {} };
    throw error;
  }

  const supabase = await createServerSupabase();

  // What the row is now, which decides whether the review gate applies.
  const existing = vote.id
    ? (
        await supabase
          .from("votes")
          .select("id, status, ai_draft")
          .eq("id", vote.id)
          .maybeSingle()
      ).data
    : null;

  if (vote.id && !existing) {
    return { ok: false, message: "That vote is no longer there.", fieldErrors: {} };
  }

  const fieldErrors = validate(vote);

  // A draft a model wrote is not publishable until a person says they read the
  // document behind it. The form disables the button; this refuses the write.
  if (vote.publish && existing?.ai_draft && !vote.confirmedAgainstSource) {
    fieldErrors.confirmedAgainstSource =
      "Open the source document and confirm you checked this against it before publishing.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: vote.publish
        ? "Nothing was published. Check the fields marked below."
        : "Nothing was saved. Check the fields marked below.",
      fieldErrors,
    };
  }

  const now = new Date().toISOString();
  const fields = {
    meeting_id: vote.meetingId,
    item_title: vote.itemTitle.trim(),
    summary: vote.summary.trim(),
    category: vote.category,
    amount: vote.amount.trim().length > 0 ? Number(vote.amount.replace(/[$,\s]/g, "")) : null,
    agenda_item_url: vote.agendaItemUrl.trim() || null,
  };

  // Publishing clears ai_draft: whatever a model wrote has now been read by
  // the person recorded in reviewed_by.
  const publishing = vote.publish
    ? {
        status: "published" as const,
        published_at: now,
        ai_draft: false,
        reviewed_by: await reviewerId(),
        reviewed_at: now,
      }
    : { status: "draft" as const, published_at: null };

  let voteId = vote.id;

  if (existing) {
    const { error } = await supabase
      .from("votes")
      .update({ ...fields, ...publishing })
      .eq("id", existing.id);
    if (error) {
      return { ok: false, message: `Nothing was saved: ${error.message}`, fieldErrors: {} };
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("votes")
      .insert({ ...fields, ...publishing })
      .select("id")
      .single();
    if (error || !inserted) {
      return { ok: false, message: `Nothing was saved: ${error?.message}`, fieldErrors: {} };
    }
    voteId = inserted.id;
  }

  if (vote.rollCall.length > 0 && voteId) {
    // The roll call is replaced wholesale, so correcting one member's vote on a
    // draft does not leave the old row beside the new one.
    await supabase.from("vote_members").delete().eq("vote_id", voteId);
    const { error: membersError } = await supabase.from("vote_members").insert(
      vote.rollCall.map((r) => ({ vote_id: voteId!, person_id: r.personId, vote: r.vote })),
    );

    if (membersError) {
      if (!existing) {
        // Without the roll call the vote would publish with a tally nobody can
        // check, so a new vote is removed rather than left half recorded.
        await supabase.from("votes").delete().eq("id", voteId);
      }
      return {
        ok: false,
        message: `The roll call could not be saved. ${membersError.message}`,
        fieldErrors: {},
      };
    }
  }

  revalidateFor("vote");
  return {
    ok: true,
    message: vote.publish ? "Vote published." : "Vote saved as draft.",
    fieldErrors: {},
  };
}

/** Active members of the body that held this meeting, in roll call order. */
export async function getRollCallMembers(meetingId: string) {
  try {
    await requireAdminUser();
  } catch {
    return [];
  }
  if (!meetingId) return [];

  const supabase = await createServerSupabase();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("body_id")
    .eq("id", meetingId)
    .maybeSingle();
  if (!meeting?.body_id) return [];

  const { data } = await supabase
    .from("people")
    .select("id, name, title")
    .eq("body_id", meeting.body_id)
    .eq("role", "body_member")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return data ?? [];
}
