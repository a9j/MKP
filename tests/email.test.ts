/**
 * The disk fallback for outgoing mail.
 *
 * Without RESEND_API_KEY the message is written to disk so development can read
 * it rather than lose it. A deployed host serves from a read only filesystem,
 * where that write throws, and it used to throw straight out of sendEmail. The
 * first contact form submission after a deploy with no Resend key would have
 * stored the inquiry and then returned a server error to the person who wrote
 * it. This is the branch that now refuses instead of throwing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeEmailToDisk } from "../src/lib/email-disk";

const FROM = "The Mona K Project <hello@monakproject.org>";
const MESSAGE = {
  to: ["council@example.com", "second@example.com"],
  subject: "A draft to review",
  text: "Plain text body.",
  html: "<p>Plain text body.</p>",
};

function withTempDir<T>(run: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "mkp-email-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a writable directory keeps the whole message where it can be read", () => {
  withTempDir((dir) => {
    const path = writeEmailToDisk(join(dir, "emails"), FROM, MESSAGE);
    assert.ok(path, "expected a path back");

    const written = JSON.parse(readFileSync(path!, "utf8"));
    assert.equal(written.from, FROM);
    assert.equal(written.subject, MESSAGE.subject);
    assert.equal(written.text, MESSAGE.text);
    assert.deepEqual(written.to, MESSAGE.to, "every recipient is recorded, not just the first");
  });
});

test("a filesystem that refuses the write returns null rather than throwing", () => {
  withTempDir((dir) => {
    // A file where a directory would have to go. mkdir cannot succeed, which is
    // the same shape of refusal as a read only filesystem.
    const blocked = join(dir, "emails");
    writeFileSync(blocked, "not a directory");

    let result: string | null = "not run";
    assert.doesNotThrow(() => {
      result = writeEmailToDisk(blocked, FROM, MESSAGE);
    });
    assert.equal(result, null);
  });
});

test("a subject that is not a filename still produces one", () => {
  withTempDir((dir) => {
    const awkward = { ...MESSAGE, subject: "../../escape? yes/no: \"maybe\"" };
    const path = writeEmailToDisk(join(dir, "emails"), FROM, awkward);
    assert.ok(path, "expected a path back");
    assert.ok(path!.startsWith(join(dir, "emails")), `wrote outside the directory: ${path}`);
    assert.equal(JSON.parse(readFileSync(path!, "utf8")).subject, awkward.subject);
  });
});

test("two messages in the same run do not overwrite each other", () => {
  withTempDir((dir) => {
    const first = writeEmailToDisk(join(dir, "emails"), FROM, MESSAGE);
    const second = writeEmailToDisk(join(dir, "emails"), FROM, { ...MESSAGE, text: "Second." });
    assert.ok(first && second);
    assert.notEqual(first, second, "the second message replaced the first");
  });
});
