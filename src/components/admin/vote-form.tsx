"use client";

import { useEffect, useState, useTransition } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Toast, type ToastTone } from "@/components/admin/toast";
import {
  createMeeting,
  getRollCallMembers,
  saveVote,
  type MeetingKind,
  type VoteChoice,
} from "@/lib/actions/votes";
import { SUMMARY_MAX } from "@/lib/limits";

type Body = { id: string; name: string; slug: string };
type Member = { id: string; name: string; title: string | null };

export type MeetingOption = {
  id: string;
  bodyId: string;
  bodyName: string;
  meetingDate: string;
  label: string;
  agendaUrl: string | null;
  minutesUrl: string | null;
};

export type EditableVote = {
  id: string;
  meetingId: string;
  itemTitle: string;
  summary: string;
  category: "money" | "staffing" | "contracts" | "facilities" | "other";
  amount: string;
  agendaItemUrl: string;
  aiDraft: boolean;
  aiModel: string | null;
  aiConfidence: number | null;
  rollCall: Record<string, VoteChoice>;
};

const CHOICES: { value: VoteChoice; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "abstain", label: "Abstain" },
  { value: "absent", label: "Absent" },
];

const CATEGORIES = [
  { value: "money", label: "Money" },
  { value: "staffing", label: "Staffing" },
  { value: "contracts", label: "Contracts" },
  { value: "facilities", label: "Facilities" },
  { value: "other", label: "Other" },
] as const;

/** Anything under this is worth a second look before it is published. */
const LOW_CONFIDENCE = 0.6;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VoteForm({
  bodies,
  meetings,
  draft,
}: {
  bodies: Body[];
  meetings: MeetingOption[];
  draft?: EditableVote;
}) {
  const [meetingList, setMeetingList] = useState(meetings);
  const [meetingId, setMeetingId] = useState(draft?.meetingId ?? meetings[0]?.id ?? "");
  const [itemTitle, setItemTitle] = useState(draft?.itemTitle ?? "");
  const [summary, setSummary] = useState(draft?.summary ?? "");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>(
    draft?.category ?? "money",
  );
  const [amount, setAmount] = useState(draft?.amount ?? "");
  const [agendaItemUrl, setAgendaItemUrl] = useState(draft?.agendaItemUrl ?? "");

  const [members, setMembers] = useState<Member[]>([]);
  // Defaults to yes, which is how most roll calls come out, so the Executive
  // Director only touches the exceptions.
  const [rollCall, setRollCall] = useState<Record<string, VoteChoice>>(draft?.rollCall ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();

  // The review gate. A machine written draft cannot be published until this is
  // ticked, and the server refuses the write without it either way.
  const [checkedAgainstSource, setCheckedAgainstSource] = useState(false);

  const [addingMeeting, setAddingMeeting] = useState(false);

  const meeting = meetingList.find((m) => m.id === meetingId);
  const sourceUrl = agendaItemUrl.trim() || meeting?.agendaUrl || meeting?.minutesUrl || null;
  const isAiDraft = draft?.aiDraft ?? false;
  const publishBlocked = isAiDraft && !checkedAgainstSource;

  useEffect(() => {
    let cancelled = false;
    getRollCallMembers(meetingId).then((list) => {
      if (cancelled) return;
      setMembers(list);
      setRollCall((current) =>
        Object.fromEntries(list.map((m) => [m.id, current[m.id] ?? ("yes" as VoteChoice)])),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const tally = CHOICES.map((choice) => ({
    ...choice,
    count: Object.values(rollCall).filter((v) => v === choice.value).length,
  }));

  const remaining = SUMMARY_MAX - summary.length;

  function submit(publish: boolean) {
    startTransition(async () => {
      const result = await saveVote({
        id: draft?.id,
        meetingId,
        itemTitle,
        summary,
        category,
        amount,
        agendaItemUrl,
        publish,
        confirmedAgainstSource: checkedAgainstSource,
        rollCall: Object.entries(rollCall).map(([personId, vote]) => ({ personId, vote })),
      });
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok && !draft) {
        setItemTitle("");
        setSummary("");
        setAmount("");
        setAgendaItemUrl("");
      }
    });
  }

  return (
    <form
      className="admin-form vote-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit(true);
      }}
    >
      {isAiDraft ? (
        <div className="field-wide draft-banner" role="status">
          <p className="badge-ai">AI draft, unreviewed</p>
          <p>
            Software read the agenda and wrote this. Nothing here has been checked
            against the document yet.
            {draft?.aiConfidence !== null && draft?.aiConfidence !== undefined
              ? ` The model reported ${Math.round(draft.aiConfidence * 100)} percent confidence.`
              : ""}
            {draft?.aiConfidence !== null &&
            draft?.aiConfidence !== undefined &&
            draft.aiConfidence < LOW_CONFIDENCE
              ? " That is low."
              : ""}
          </p>
        </div>
      ) : null}

      <div className="field field-wide">
        <label htmlFor="vote-meeting">Meeting</label>
        <select
          id="vote-meeting"
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
        >
          {meetingList.length === 0 ? <option value="">No meetings recorded yet</option> : null}
          {meetingList.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {errors.meetingId ? <p className="field-error">{errors.meetingId}</p> : null}
        <button
          type="button"
          className="inline-add"
          onClick={() => setAddingMeeting((open) => !open)}
          aria-expanded={addingMeeting}
        >
          {addingMeeting ? "Cancel" : "New meeting"}
        </button>
      </div>

      {addingMeeting ? (
        <NewMeetingFields
          bodies={bodies}
          onAdded={(option) => {
            setMeetingList((list) => [option, ...list]);
            setMeetingId(option.id);
            setAddingMeeting(false);
            setToast({ message: "Meeting added.", tone: "ok" });
          }}
          onError={(message) => setToast({ message, tone: "error" })}
        />
      ) : null}

      <div className="field field-wide">
        <label htmlFor="vote-title">Agenda item title</label>
        <input
          id="vote-title"
          value={itemTitle}
          onChange={(e) => setItemTitle(e.target.value)}
          required
        />
        {errors.itemTitle ? <p className="field-error">{errors.itemTitle}</p> : null}
      </div>

      <div className="field field-wide">
        <label htmlFor="vote-summary">
          Plain summary, one sentence describing what was decided
        </label>
        <textarea
          id="vote-summary"
          rows={3}
          maxLength={SUMMARY_MAX}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          aria-describedby="vote-summary-count"
          required
        />
        <p
          id="vote-summary-count"
          className={remaining < 20 ? "counter counter-low" : "counter"}
          aria-live="polite"
        >
          {remaining} characters left of {SUMMARY_MAX}
        </p>
        {errors.summary ? <p className="field-error">{errors.summary}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="vote-category">Category</label>
        <select
          id="vote-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="vote-amount">Dollar amount, if any</label>
        <input
          id="vote-amount"
          inputMode="decimal"
          placeholder="Leave empty if none"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {errors.amount ? <p className="field-error">{errors.amount}</p> : null}
      </div>

      <div className="field field-wide">
        <label htmlFor="vote-agenda-item">Agenda item link</label>
        <input
          id="vote-agenda-item"
          type="url"
          placeholder="https://"
          value={agendaItemUrl}
          onChange={(e) => setAgendaItemUrl(e.target.value)}
        />
        <p className="counter">
          The paper for this item. The agenda and minutes for the meeting as a whole
          are kept on the meeting.
        </p>
        {errors.agendaItemUrl ? <p className="field-error">{errors.agendaItemUrl}</p> : null}
      </div>

      <fieldset className="field-wide rollcall">
        <legend>Roll call</legend>
        {errors.rollCall ? <p className="field-error">{errors.rollCall}</p> : null}
        {members.length === 0 ? (
          <p className="admin-help">No active members recorded for this body yet.</p>
        ) : (
          members.map((member) => (
            <div className="rollcall-row" key={member.id}>
              <span className="rollcall-name" id={`member-${member.id}`}>
                {member.name}
              </span>
              <RadioGroup.Root
                className="segmented"
                value={rollCall[member.id] ?? "yes"}
                onValueChange={(value) =>
                  setRollCall((current) => ({ ...current, [member.id]: value as VoteChoice }))
                }
                aria-labelledby={`member-${member.id}`}
              >
                {CHOICES.map((choice) => (
                  <RadioGroup.Item
                    key={choice.value}
                    className="segment"
                    value={choice.value}
                    id={`${member.id}-${choice.value}`}
                  >
                    {choice.label}
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </div>
          ))
        )}

        <p className="tally-line" aria-live="polite">
          Tally: {tally.map((t) => `${t.count} ${t.label.toLowerCase()}`).join(", ")}
        </p>
      </fieldset>

      {isAiDraft ? (
        <div className="field-wide review-gate">
          <h4>Check it against the document</h4>
          {sourceUrl ? (
            <p className="preview-url">
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Open the source document
              </a>
            </p>
          ) : (
            <p className="admin-help">
              No source link is recorded. Add the agenda item link above before publishing.
            </p>
          )}
          <label className="check-row" htmlFor="vote-checked">
            <input
              id="vote-checked"
              type="checkbox"
              checked={checkedAgainstSource}
              onChange={(e) => setCheckedAgainstSource(e.target.checked)}
            />
            I checked this against the document.
          </label>
          {errors.confirmedAgainstSource ? (
            <p className="field-error">{errors.confirmedAgainstSource}</p>
          ) : null}
        </div>
      ) : null}

      <div className="admin-actions">
        <button className="btn" type="submit" disabled={pending || publishBlocked}>
          {pending ? "Saving" : "Publish"}
        </button>
        <button
          type="button"
          className="text-link"
          onClick={() => submit(false)}
          disabled={pending}
        >
          Save as draft
        </button>
      </div>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </form>
  );
}

/**
 * The inline "new meeting" fields.
 *
 * Kept in the same screen rather than behind a link: after a board meeting the
 * meeting and the first vote are entered together, usually on a phone.
 */
function NewMeetingFields({
  bodies,
  onAdded,
  onError,
}: {
  bodies: Body[];
  onAdded: (meeting: MeetingOption) => void;
  onError: (message: string) => void;
}) {
  const [bodyId, setBodyId] = useState(bodies[0]?.id ?? "");
  const [meetingDate, setMeetingDate] = useState(today());
  const [kind, setKind] = useState<MeetingKind>("regular");
  const [agendaUrl, setAgendaUrl] = useState("");
  const [minutesUrl, setMinutesUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await createMeeting({ bodyId, meetingDate, kind, agendaUrl, minutesUrl, videoUrl });
      setErrors(result.fieldErrors);
      if (!result.ok || !result.meetingId) {
        onError(result.message);
        return;
      }
      const bodyName = bodies.find((b) => b.id === bodyId)?.name ?? "Not stated";
      onAdded({
        id: result.meetingId,
        bodyId,
        bodyName,
        meetingDate,
        label: `${bodyName}, ${meetingDate}${kind === "special" ? ", special" : ""}`,
        agendaUrl: agendaUrl.trim() || null,
        minutesUrl: minutesUrl.trim() || null,
      });
    });
  }

  return (
    <fieldset className="field-wide rollcall">
      <legend>New meeting</legend>

      <div className="field">
        <label htmlFor="meeting-body">Body</label>
        <select id="meeting-body" value={bodyId} onChange={(e) => setBodyId(e.target.value)}>
          {bodies.map((body) => (
            <option key={body.id} value={body.id}>
              {body.name}
            </option>
          ))}
        </select>
        {errors.bodyId ? <p className="field-error">{errors.bodyId}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="meeting-date">Meeting date</label>
        <input
          id="meeting-date"
          type="date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
        />
        {errors.meetingDate ? <p className="field-error">{errors.meetingDate}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="meeting-kind">Kind</label>
        <select
          id="meeting-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as MeetingKind)}
        >
          <option value="regular">Regular</option>
          <option value="special">Special</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="meeting-agenda">Agenda link</label>
        <input
          id="meeting-agenda"
          type="url"
          placeholder="https://"
          value={agendaUrl}
          onChange={(e) => setAgendaUrl(e.target.value)}
        />
        {errors.agendaUrl ? <p className="field-error">{errors.agendaUrl}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="meeting-minutes">Minutes link</label>
        <input
          id="meeting-minutes"
          type="url"
          placeholder="https://"
          value={minutesUrl}
          onChange={(e) => setMinutesUrl(e.target.value)}
        />
        {errors.minutesUrl ? <p className="field-error">{errors.minutesUrl}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="meeting-video">Video link</label>
        <input
          id="meeting-video"
          type="url"
          placeholder="https://"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        {errors.videoUrl ? <p className="field-error">{errors.videoUrl}</p> : null}
      </div>

      <div className="admin-actions">
        <button type="button" className="btn ghost" onClick={add} disabled={pending}>
          {pending ? "Adding" : "Add meeting"}
        </button>
      </div>
    </fieldset>
  );
}
