import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The development fallback for outgoing mail: the message is kept on disk so
 * it can be read instead of vanishing.
 *
 * Separate from email.ts, which is server only because it holds the Resend
 * key. Nothing here is a secret, and keeping it apart means the one thing that
 * can fail on a deployed host is testable on its own.
 */
export type StoredEmail = {
  to: string[];
  subject: string;
  text: string;
  html: string;
};

/**
 * Writes the message under `dir` and returns the path.
 *
 * Returns null when the filesystem refuses, which is the normal case on a
 * deployed host: Vercel serves from a read only filesystem outside /tmp. That
 * is not an error worth throwing. The caller decides what an unsent message
 * means, and for the contact form it must not lose an inquiry already stored.
 */
export function writeEmailToDisk(
  dir: string,
  from: string,
  email: StoredEmail,
): string | null {
  try {
    mkdirSync(dir, { recursive: true });
    // The timestamp sorts the directory by send order. The suffix is what
    // keeps two messages sent in the same millisecond, which is what a loop
    // over recipients does, from becoming one file.
    const stamp = Date.now();
    const slug = email.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
    const name = `${stamp}-${randomBytes(3).toString("hex")}-${slug}.json`;
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify({ from, ...email }, null, 2));
    return path;
  } catch {
    return null;
  }
}
