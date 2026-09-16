"use client";

import { useRef, useState, useTransition } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { logCorrection } from "@/lib/actions/admin";

export function CorrectionForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await logCorrection(form);
      setErrors(result.fieldErrors);
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) formRef.current?.reset();
    });
  }

  return (
    <>
      <form className="admin-form" ref={formRef} onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="correction-date">Date</label>
          <input
            id="correction-date"
            name="correctionDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          {errors.correctionDate ? <p className="field-error">{errors.correctionDate}</p> : null}
        </div>

        <div className="field">
          <label htmlFor="correction-page">Page</label>
          <input id="correction-page" name="pagePath" placeholder="/reports/..." required />
          {errors.pagePath ? <p className="field-error">{errors.pagePath}</p> : null}
        </div>

        <div className="field field-wide">
          <label htmlFor="correction-what">What changed</label>
          <textarea id="correction-what" name="whatChanged" rows={2} required />
          {errors.whatChanged ? <p className="field-error">{errors.whatChanged}</p> : null}
        </div>

        <div className="field field-wide">
          <label htmlFor="correction-why">Why</label>
          <textarea id="correction-why" name="why" rows={2} required />
          {errors.why ? <p className="field-error">{errors.why}</p> : null}
        </div>

        <div className="admin-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Publishing" : "Publish correction"}
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
