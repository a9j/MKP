import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { readSubscribeToken, SUBSCRIBE_TOKEN_DAYS } from "@/lib/signing";

// Its own page rather than a redirect back to /get-involved, which would have
// to read the query string and so could no longer be statically rendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

const MESSAGES = {
  malformed: "That link is incomplete. Ask for a new one from the Get Involved page.",
  tampered: "That link does not look like one of ours. Ask for a new one.",
  expired: `That link has expired. They last ${SUBSCRIBE_TOKEN_DAYS} days. Ask for a new one.`,
  failed: "Something went wrong at our end. Try the link again, or write to us.",
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = readSubscribeToken(token ?? "");

  let state: "ok" | keyof typeof MESSAGES = "malformed";

  if (result.ok) {
    const service = createServiceClient();
    const { error } = await service
      .from("subscribers")
      .update({ confirmed: true })
      .eq("email", result.email);
    state = error ? "failed" : "ok";
  } else {
    state = result.reason;
  }

  return (
    <div className="wrap page-head confirm-page">
      {state === "ok" ? (
        <>
          <h1>You are on the list.</h1>
          <p className="lede">
            One email when we publish. That is the only time you will hear from us, and
            every message has a way out of it.
          </p>
          <div className="actions">
            <Link className="btn teal" href="/reports">
              Read the latest report
            </Link>
            <Link className="btn ghost" href="/">
              Back to the site
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1>That link did not work.</h1>
          <p className="lede">{MESSAGES[state]}</p>
          <div className="actions">
            <Link className="btn teal" href="/get-involved">
              Ask for a new link
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
