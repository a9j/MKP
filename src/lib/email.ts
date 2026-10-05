import "server-only";
import { join } from "node:path";
import { writeEmailToDisk } from "@/lib/email-disk";

/**
 * Outgoing mail.
 *
 * Sends through Resend when RESEND_API_KEY is set. Without it, the message is
 * written to .local-storage/emails so development and the tests can read what
 * would have gone out. Silently dropping mail would be worse than either: a
 * council review that never arrives looks the same as one nobody answered.
 */

export type Email = {
  to: string[];
  subject: string;
  text: string;
  html: string;
};

export type SendResult = {
  ok: boolean;
  /** How many addresses it went to, or would have. */
  recipients: number;
  message: string;
  /** True when it went to disk rather than to Resend. */
  local: boolean;
};

const FROM = process.env.EMAIL_FROM ?? "The Mona K Project <hello@monakproject.org>";

export async function sendEmail(email: Email): Promise<SendResult> {
  if (email.to.length === 0) {
    return { ok: false, recipients: 0, message: "There was nobody to send to.", local: false };
  }

  const key = process.env.RESEND_API_KEY;

  if (!key) {
    const written = writeEmailToDisk(join(process.cwd(), ".local-storage", "emails"), FROM, email);
    if (written) {
      return {
        ok: true,
        recipients: email.to.length,
        message: `RESEND_API_KEY is not set, so the message was written to ${written} instead of being sent.`,
        local: true,
      };
    }

    // A deployed host has a read only filesystem, so the development fallback
    // cannot run there. The message goes to the log rather than nowhere: a
    // council review that vanished looks exactly like one nobody answered.
    console.warn(
      "[email] RESEND_API_KEY is not set and the message could not be written to disk. " +
        "Nothing was sent.",
      JSON.stringify({ from: FROM, to: email.to, subject: email.subject, text: email.text }),
    );
    return {
      ok: false,
      recipients: 0,
      message:
        "RESEND_API_KEY is not set and this host has no writable disk, so nothing was sent. " +
        "The message is in the server log. Set RESEND_API_KEY to send mail.",
      local: true,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      recipients: 0,
      message: `Resend refused the message: ${response.status} ${detail.slice(0, 200)}`,
      local: false,
    };
  }

  return {
    ok: true,
    recipients: email.to.length,
    message: `Sent to ${email.to.length} address${email.to.length === 1 ? "" : "es"}.`,
    local: false,
  };
}

export { renderEmail } from "@/lib/email-template";
