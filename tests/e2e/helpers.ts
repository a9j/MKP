import type { Page } from "@playwright/test";

/** Matches the stub in scripts/supabase-gateway.mjs. Local only. */
export const DEV_PASSWORD = "local-development-password";

/**
 * Signs in the way a person does: email and password on the sign in screen.
 *
 * The local auth stub verifies the password and issues a real JWT signed with
 * the same secret PostgREST checks, so the session that comes back is filtered
 * by RLS exactly as a deployed one would be. What is faked is the auth server,
 * never this project's own code.
 */
export async function signIn(page: Page, email = "hello@monakproject.org") {
  await page.goto("/admin/login");
  await page.fill("#login-email", email);
  await page.fill("#login-password", DEV_PASSWORD);
  await page.click(".login-form button[type=submit]");
  // The form signs in through the browser client and then sets
  // window.location, so the navigation starts after the request resolves.
  // Waiting for the sign in screen to be behind us stops the next goto from
  // aborting that navigation out from under it.
  await page.waitForURL((url) => !url.pathname.startsWith("/admin/login"), {
    timeout: 20_000,
  });
  await page.waitForLoadState("load");
}
