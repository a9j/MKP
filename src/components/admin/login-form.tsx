"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Magic link only. There is deliberately no password field anywhere in this
 * project, so there is no password to phish, reuse or reset.
 */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const redirect = new URL("/admin/auth/confirm", window.location.origin);
    redirect.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    // Says the same thing whether or not the address is on the list, so the
    // form cannot be used to find out who the administrators are.
    setState("sent");
    setMessage(
      "If that address is on the administrator list, a sign in link is on its way. The link works once and expires.",
    );
  }

  if (state === "sent") {
    return (
      <p className="login-sent" role="status">
        {message}
      </p>
    );
  }

  return (
    <form className="admin-form login-form" onSubmit={onSubmit}>
      <div className="field field-wide">
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state === "error" ? (
        <p className="login-error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="admin-actions">
        <button className="btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending" : "Email me a link"}
        </button>
      </div>
    </form>
  );
}
