/**
 * The house layout for outgoing mail.
 *
 * Split from email.ts for the same reason email-disk.ts was: that module holds
 * the Resend key and carries the "server-only" guard, which puts everything in
 * it beyond the reach of a test. Nothing here is a secret, so the template can
 * be checked on its own.
 */

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
  groups,
  footer,
}: {
  title: string;
  /** Paragraphs, plain text. */
  body: string[];
  action?: { label: string; url: string };
  /**
   * Headed lists of links, for a message whose point is the list rather than
   * the prose. Each line is one thing to go and do.
   */
  groups?: { heading: string; items: { label: string; detail?: string; url: string }[] }[];
  /** A closing line under everything, above the standing footer. */
  footer?: string;
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

  // Hairline rules between groups, as on the site. No cards, no tables of
  // colour: this is a list of links and it should read as one.
  const lists = (groups ?? [])
    .map(
      (group) =>
        `<h2 style="margin:26px 0 0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${INK_2};font-weight:600">${escapeHtml(group.heading)}</h2>` +
        group.items
          .map(
            (item) =>
              `<p style="margin:12px 0 0;padding:0 0 12px;border-bottom:1px solid #E3E8ED;font-size:16px;line-height:1.45">` +
              `<a href="${escapeHtml(item.url)}" style="color:${NAVY};font-weight:500;text-decoration:underline">${escapeHtml(item.label)}</a>` +
              (item.detail
                ? `<br><span style="font-size:14px;color:${INK_2}">${escapeHtml(item.detail)}</span>`
                : "") +
              `</p>`,
          )
          .join(""),
    )
    .join("");

  const closing = footer
    ? `<p style="margin:26px 0 0;font-size:15px;color:${NAVY};font-weight:500">${escapeHtml(footer)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#F4F6F8;font-family:${font}">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:${NAVY};font-weight:600">${escapeHtml(title)}</h1>
    <div style="height:2px;width:56px;background:${GOLD};margin:0 0 22px"></div>
    ${paragraphs}
    ${lists}
    ${button}
    ${closing}
    <p style="margin:28px 0 0;font-size:13px;color:#64717D">
      The Mona K Project. We do not take positions, endorse candidates, or recommend how to vote.
    </p>
  </div>
</body></html>`;

  const textGroups = (groups ?? []).flatMap((group) => [
    "",
    // Not uppercased: the HTML does that with text-transform, for looks. The
    // plain text version is read as words, and a body's name is a name.
    group.heading,
    ...group.items.map((item) =>
      item.detail ? `- ${item.label} (${item.detail})\n  ${item.url}` : `- ${item.label}\n  ${item.url}`,
    ),
  ]);

  const text = [
    title,
    "",
    ...body,
    ...textGroups,
    action ? `\n${action.label}: ${action.url}` : "",
    footer ? `\n${footer}` : "",
  ]
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
