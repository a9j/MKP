"use client";

import { useRef, useState, useTransition } from "react";
import { subscribe } from "@/lib/actions/public";

/** One email when we publish. Nothing is sent until the address is confirmed. */
export function SubscribeForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await subscribe(form);
      if (result.ok) {
        setMessage(result.message);
        setError(null);
        formRef.current?.reset();
      } else {
        setError(result.fieldErrors.email ?? result.message);
      }
    });
  }

  if (message) {
    return (
      <p className="login-sent" role="status">
        {message}
      </p>
    );
  }

  return (
    <form className="subscribe" ref={formRef} onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="subscribe-email">Email address</label>
        <input
          id="subscribe-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
        />
        {error ? <p className="field-error">{error}</p> : null}
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending" : "Subscribe"}
      </button>
    </form>
  );
}
