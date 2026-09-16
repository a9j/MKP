import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
    const dir = join(process.cwd(), ".local-storage", "emails");
    mkdirSync(dir, { recursive: true });
    const name = `${Date.now()}-${email.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}.json`;
    writeFileSync(join(dir, name), JSON.stringify({ from: FROM, ...email }, null, 2));
    return {
      ok: true,
      recipients: email.to.length,
      message: `RESEND_API_KEY is not set, so the message was written to .local-storage/emails instead of being sent.`,
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

const NAVY = "#0F2A44";
const GOLD = "#D9A441";
const INK_2 = "#4B5A6B";

/**
 * The house layout: navy heading, a gold rule under the title, and a font
 * stack that falls back to the system sans where Instrument Sans is not
 * available, which in mail is almost everywhere.
 */
export function renderEmail({
  title,
  body,
  action,
}: {
  title: string;
  /** Paragraphs, plain text. */
  body: string[];
  action?: { label: string; url: string };
}): { html: string; text: string } {
  const font = `'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

  const paragraphs = body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK_2}">${escapeHtml(line)}</p>`,
    )
    .join("");

  const button = action
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;font-weight:500">${escapeHtml(action.label)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F4F6F8;font-family:${font}">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:${NAVY};font-weight:600">${escapeHtml(title)}</h1>
    <div style="height:2px;width:56px;background:${GOLD};margin:0 0 22px"></div>
    ${paragraphs}
    ${button}
    <p style="margin:28px 0 0;font-size:13px;color:#64717D">
      The Mona K Project. We do not take positions, endorse candidates, or recommend how to vote.
    </p>
  </div>
</body></html>`;

  const text = [title, "", ...body, action ? `\n${action.label}: ${action.url}` : ""]
    .join("\n")
    .trim();

  return { html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
