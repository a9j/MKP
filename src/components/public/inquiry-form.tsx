"use client";

import { useRef, useState, useTransition } from "react";
import { submitInquiry, type InquiryKind } from "@/lib/actions/public";

type Props = {
  kind: InquiryKind;
  submitLabel: string;
  /** The "I am a" choices, contact form only. */
  audiences?: string[];
  messageLabel?: string;
  idPrefix: string;
};

export function InquiryForm({ kind, submitLabel, audiences, messageLabel, idPrefix }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await submitInquiry(form);
      setErrors(result.fieldErrors);
      if (result.ok) {
        setDone(result.message);
        setFailed(null);
        formRef.current?.reset();
      } else {
        setFailed(result.message);
      }
    });
  }

  if (done) {
    return (
      <p className="login-sent" role="status">
        {done}
      </p>
    );
  }

  return (
    <form className="admin-form public-form" ref={formRef} onSubmit={onSubmit}>
      <input type="hidden" name="kind" value={kind} />

      <div className="field">
        <label htmlFor={`${idPrefix}-name`}>Name</label>
        <input id={`${idPrefix}-name`} name="name" autoComplete="name" required />
        {errors.name ? <p className="field-error">{errors.name}</p> : null}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-email`}>Email</label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
        {errors.email ? <p className="field-error">{errors.email}</p> : null}
      </div>

      {audiences ? (
        <div className="field field-wide">
          <label htmlFor={`${idPrefix}-audience`}>I am a</label>
          <select id={`${idPrefix}-audience`} name="audience" defaultValue={audiences[0]}>
            {audiences.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field field-wide">
        <label htmlFor={`${idPrefix}-message`}>{messageLabel ?? "Message"}</label>
        <textarea id={`${idPrefix}-message`} name="message" rows={5} required />
        {errors.message ? <p className="field-error">{errors.message}</p> : null}
      </div>

      {failed ? (
        <p className="field-error" role="alert">
          {failed}
        </p>
      ) : null}

      <div className="admin-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Sending" : submitLabel}
        </button>
      </div>
    </form>
  );
}
