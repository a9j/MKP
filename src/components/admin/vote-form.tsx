"use client";

import { useEffect, useState, useTransition } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { createVote, getRollCallMembers, type VoteChoice } from "@/lib/actions/votes";
import { SUMMARY_MAX } from "@/lib/limits";

type Body = { id: string; name: string; slug: string };
type Member = { id: string; name: string; title: string | null };

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VoteForm({ bodies }: { bodies: Body[] }) {
  const [bodyId, setBodyId] = useState(bodies[0]?.id ?? "");
  const [meetingDate, setMeetingDate] = useState(today());
  const [itemTitle, setItemTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("money");
  const [amount, setAmount] = useState("");
  const [agendaUrl, setAgendaUrl] = useState("");
  const [minutesUrl, setMinutesUrl] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  // Defaults to yes, which is how most roll calls come out, so the Executive
  // Director only touches the exceptions.
  const [rollCall, setRollCall] = useState<Record<string, VoteChoice>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getRollCallMembers(bodyId).then((list) => {
      if (cancelled) return;
      setMembers(list);
      setRollCall(Object.fromEntries(list.map((m) => [m.id, "yes" as VoteChoice])));
    });
    return () => {
      cancelled = true;
    };
  }, [bodyId]);

  const tally = CHOICES.map((choice) => ({
    ...choice,
    count: Object.values(rollCall).filter((v) => v === choice.value).length,
  }));

  const remaining = SUMMARY_MAX - summary.length;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createVote({
        bodyId,
        meetingDate,
        itemTitle,
        summary,
        category,
        amount,
        agendaUrl,
        minutesUrl,
        rollCall: Object.entries(rollCall).map(([personId, vote]) => ({ personId, vote })),
      });
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) {
        setItemTitle("");
        setSummary("");
        setAmount("");
        setAgendaUrl("");
        setMinutesUrl("");
      }
    });
  }

  return (
    <form className="admin-form vote-form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="vote-date">Meeting date</label>
        <input
          id="vote-date"
          type="date"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          required
        />
        {errors.meetingDate ? <p className="field-error">{errors.meetingDate}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="vote-body">Body</label>
        <select id="vote-body" value={bodyId} onChange={(e) => setBodyId(e.target.value)}>
          {bodies.map((body) => (
            <option key={body.id} value={body.id}>
              {body.name}
            </option>
          ))}
        </select>
        {errors.bodyId ? <p className="field-error">{errors.bodyId}</p> : null}
      </div>

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

      <div className="field">
        <label htmlFor="vote-agenda">Agenda link</label>
        <input
          id="vote-agenda"
          type="url"
          placeholder="https://"
          value={agendaUrl}
          onChange={(e) => setAgendaUrl(e.target.value)}
        />
        {errors.agendaUrl ? <p className="field-error">{errors.agendaUrl}</p> : null}
      </div>

      <div className="field">
        <label htmlFor="vote-minutes">Minutes link</label>
        <input
          id="vote-minutes"
          type="url"
          placeholder="https://"
          value={minutesUrl}
          onChange={(e) => setMinutesUrl(e.target.value)}
          />
        {errors.minutesUrl ? <p className="field-error">{errors.minutesUrl}</p> : null}
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

      <div className="admin-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Publishing" : "Publish vote"}
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
