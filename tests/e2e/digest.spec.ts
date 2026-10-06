/**
 * The daily digest, driven through the route itself.
 *
 * The unit tests cover what it says and in what order. What is worth driving
 * end to end is the part that touches everything at once: the guard on the
 * route, the read of the review queue, and the mail that comes out of it.
 *
 * The local stack writes mail to .local-storage/emails rather than sending it,
 * so the message can be read back and checked.
 */
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { signIn } from "./helpers";

const SECRET = process.env.CRON_SECRET ?? "local-development-cron-secret";

function latestEmail(): { to: string[]; subject: string; text: string; html: string } | null {
  const dir = ".local-storage/emails";
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).sort();
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(`${dir}/${files[files.length - 1]}`, "utf8"));
}

test.describe("the daily digest", () => {
  test("a caller without the shared secret is refused", async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL });

    const bare = await api.get("/api/cron/digest");
    expect(bare.status()).toBe(401);

    const wrong = await api.get("/api/cron/digest", {
      headers: { authorization: "Bearer not-the-secret" },
    });
    expect(wrong.status()).toBe(401);
  });

  test("it lists what is waiting, with a link into each form", async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL });
    const response = await api.get("/api/cron/digest", {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    // The seed always leaves drafts waiting, so this run has something to say.
    expect(body.status).toBe("ok");
    expect(body.items).toBeGreaterThan(0);
    expect(body.recipients).toBeGreaterThan(0);

    const mail = latestEmail();
    expect(mail, "the digest should have been written to disk").not.toBeNull();
    expect(mail!.subject).toMatch(/^\[\d+\] items? waiting on you$/);
    expect(mail!.subject).toContain(String(body.items));

    // Every line is something to go and do, so every line is a link into the
    // form for it, absolute because a link in an email has no page to be
    // relative to.
    expect(mail!.text).toMatch(/https?:\/\/[^\s]+\/admin\//);
    expect(mail!.html).toMatch(/href="https?:\/\/[^"]+\/admin\//);

    // The machine written draft from the seed is marked as one here too.
    expect(mail!.text).toContain("AI draft, unreviewed");

    expect(mail!.text).toContain("Nothing publishes until you approve it.");
    expect(mail!.html).toContain("Nothing publishes until you approve it.");
  });

  test("the dashboard says when each scheduled job last ran", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin");

    const jobs = page.locator(".watcher-status");
    await expect(jobs).toContainText("Daily digest");
    await expect(jobs).toContainText("Council agenda watcher");

    // The digest ran in the test above, so it is not stale; the watchers have
    // never run at all, and the dashboard says so rather than staying silent.
    const digestRow = jobs.locator("li").filter({ hasText: "Daily digest" });
    await expect(digestRow).toContainText("last run");

    const councilRow = jobs.locator("li").filter({ hasText: "Council agenda watcher" });
    await expect(councilRow).toContainText("has never run");
    await expect(councilRow).toHaveClass(/stale/);
  });
});
