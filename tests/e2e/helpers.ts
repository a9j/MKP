import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/**
 * Signs in the way a person does: ask for a link, then follow it.
 *
 * The local auth stub writes the link to a file instead of emailing it, so the
 * real magic link flow is exercised rather than a session being faked.
 */
export async function signIn(page: Page, email = "hello@monakproject.org") {
  await page.goto("/admin/login");
  await page.fill("#login-email", email);
  await page.click(".login-form button[type=submit]");
  await page.waitForSelector(".login-sent", { timeout: 20_000 });

  const links = JSON.parse(readFileSync(".local-storage/magic-links.json", "utf8"));
  await page.goto(links[email].link);
  await page.waitForLoadState("load");
}
