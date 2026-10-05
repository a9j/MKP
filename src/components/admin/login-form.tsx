"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Email + password sign in for administrators.
 */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setMessage("");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setState("error");
      setMessage(error.message);
      return;
    }

    // Being signed in is not the same as being allowed in. Under magic links
    // the confirm route turned a non-administrator away here, with a message;
    // password sign in has no such route, so the check happens now. The admins
    // table is readable only to an administrator, so an empty read is the
    // answer: no row, not on the list.
    //
    // This is a courtesy, not the boundary. Every admin page and every server
    // action checks for itself, and RLS refuses the write regardless.
    const { data: rows } = await supabase.from("admins").select("id").limit(1);
    if (!rows || rows.length === 0) {
      await supabase.auth.signOut();
      setState("error");
      setMessage("That address is not on the administrator list.");
      return;
    }

    window.location.href = next;
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
      <div className="field field-wide">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {state === "error" ? (
        <p className="login-error" role="alert">
          {message}
        </p>
      ) : null}
      <div className="admin-actions">
        <button className="btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Signing in" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
