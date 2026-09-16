"use client";

import { useRef, useState, useTransition } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { RepeatingRows } from "@/components/admin/repeating-rows";
import { saveListeningSession } from "@/lib/actions/admin";

export function ListeningForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveListeningSession(form);
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <>
      <form className="admin-form" ref={formRef} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="listening-date">Session date</label>
          <input
            id="listening-date"
            name="sessionDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          {errors.sessionDate ? <p className="field-error">{errors.sessionDate}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="listening-audience">Audience</label>
          <select id="listening-audience" name="audience" defaultValue="teachers">
            <option value="teachers">Teachers</option>
            <option value="parents">Parents</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="listening-count">Attendee count</label>
          <input id="listening-count" name="attendeeCount" inputMode="numeric" />
          {errors.attendeeCount ? <p className="field-error">{errors.attendeeCount}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="listening-status">Status</label>
          <select id="listening-status" name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="field field-wide">
          <label htmlFor="listening-summary">Summary, markdown</label>
          <textarea id="listening-summary" name="summary" rows={4} required />
          {errors.summary ? <p className="field-error">{errors.summary}</p> : null}
        </div>

        <RepeatingRows
          name="heard"
          legend="What we heard"
          placeholder="Planning time is the first thing people raise."
          error={errors.heard}
        />
        <RepeatingRows
          name="changes"
          legend="What it changes"
          placeholder="The next pay report will break out planning time."
        />

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving" : "Save"}
          </button>
        </div>
      </form>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
