import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { signIn } from "./helpers";

const PSQL = "/usr/lib/postgresql/16/bin/psql";
const db = (sql: string) =>
  execFileSync(PSQL, ["-h", "/tmp", "-p", "55432", "-U", "postgres", "-d", "mkp_dev", "-tAc", sql], {
    encoding: "utf8",
  }).trim();

function emails(): { to: string[]; subject: string; text: string; html: string }[] {
  const dir = ".local-storage/emails";
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
}

test.describe("contact and inquiries", () => {
  test("a contact message is stored and sent on", async ({ page }) => {
    rmSync(".local-storage/emails", { recursive: true, force: true });
    const name = `Tester ${Date.now()}`;

    await page.goto("/contact");
    await page.fill("#contact-name", name);
    await page.fill("#contact-email", "tester@example.com");
    await page.selectOption("#contact-audience", "Teacher");
    await page.fill("#contact-message", "Is step 7 right on the pay report?");
    await page.click(".public-form button[type=submit]");

    await expect(page.locator(".login-sent")).toContainText("We read everything");

    // The row is what matters. The mail is a notification on top of it.
    expect(db(`select count(*) from inquiries where name = '${name}'`)).toBe("1");
    expect(db(`select kind from inquiries where name = '${name}'`)).toBe("contact");
    expect(db(`select audience from inquiries where name = '${name}'`)).toBe("Teacher");

    const sent = emails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toEqual(["hello@monakproject.org"]);
    expect(sent[0].subject).toContain("Contact form");
  });

  test("the form refuses a bad address without losing the message", async ({ page }) => {
    await page.goto("/contact");
    await page.fill("#contact-name", "Someone");
    await page.fill("#contact-email", "not-an-address");
    await page.fill("#contact-message", "Hello");
    // The browser blocks a malformed type=email before the action runs.
    expect(await page.$eval("#contact-email", (el: HTMLInputElement) => el.validity.valid)).toBe(
      false,
    );
  });

  test("get involved carries all three inquiry forms", async ({ page }) => {
    await page.goto("/get-involved");
    await expect(page.locator("#council-name")).toBeVisible();
    await expect(page.locator("#volunteer-name")).toBeVisible();
    await expect(page.locator("#briefing-name")).toBeVisible();
  });
});

test.describe("subscribing", () => {
  test("nothing is sent until the address is confirmed", async ({ page }) => {
    rmSync(".local-storage/emails", { recursive: true, force: true });
    const address = `reader-${Date.now()}@example.com`;

    await page.goto("/get-involved");
    await page.fill("#subscribe-email", address);
    await page.click(".subscribe button[type=submit]");
    await expect(page.locator(".login-sent")).toContainText("confirm");

    // Stored, but not confirmed.
    expect(db(`select confirmed from subscribers where email = '${address}'`)).toBe("f");

    const confirmation = emails().find((e) => e.to.includes(address));
    expect(confirmation).toBeTruthy();
    expect(confirmation!.subject).toBe("Confirm your email");

    const link = confirmation!.text.match(/https?:\/\/\S+/)?.[0];
    expect(link).toBeTruthy();

    await page.goto(link!);
    await expect(page.locator("h1")).toContainText("You are on the list");
    expect(db(`select confirmed from subscribers where email = '${address}'`)).toBe("t");
  });

  test("a tampered confirmation link is refused", async ({ page }) => {
    const address = `tamper-${Date.now()}@example.com`;
    rmSync(".local-storage/emails", { recursive: true, force: true });

    await page.goto("/get-involved");
    await page.fill("#subscribe-email", address);
    await page.click(".subscribe button[type=submit]");
    await expect(page.locator(".login-sent")).toBeVisible();

    const link = emails().find((e) => e.to.includes(address))!.text.match(/https?:\/\/\S+/)![0];
    // Flip the last character of the signature.
    const broken = link.slice(0, -1) + (link.endsWith("A") ? "B" : "A");

    await page.goto(broken);
    await expect(page.locator("h1")).toContainText("did not work");
    expect(db(`select confirmed from subscribers where email = '${address}'`)).toBe("f");
  });

  test("a publish notice reaches confirmed subscribers only, and only on purpose", async ({
    page,
  }) => {
    const confirmed = `yes-${Date.now()}@example.com`;
    const unconfirmed = `no-${Date.now()}@example.com`;
    db(`insert into subscribers (email, confirmed) values ('${confirmed}', true), ('${unconfirmed}', false)`);

    await signIn(page);
    await page.goto("/admin/subscribers");

    const confirmedCount = Number(db("select count(*) from subscribers where confirmed"));
    await expect(page.locator(".diff dd").first()).toHaveText(String(confirmedCount));

    rmSync(".local-storage/emails", { recursive: true, force: true });
    await page.click('button:has-text("Send publish notice")');

    // The dialog states the count before anything is sent.
    await expect(page.locator(".dialog")).toContainText(`Send this to ${confirmedCount} people?`);
    await page.click(`button:has-text("Send to ${confirmedCount}")`);
    await expect(page.locator(".toast")).toContainText("confirmed subscriber");

    const notice = emails().at(-1)!;
    expect(notice.to).toContain(confirmed);
    expect(notice.to).not.toContain(unconfirmed);
  });

  test("cancelling the dialog sends nothing", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/subscribers");
    rmSync(".local-storage/emails", { recursive: true, force: true });

    await page.click('button:has-text("Send publish notice")');
    await page.click('.dialog button:has-text("Cancel")');
    await expect(page.locator(".dialog")).toHaveCount(0);
    expect(emails().length).toBe(0);
  });
});

test.describe("listening, people and corrections", () => {
  test("a draft listening summary stays off the public page until published", async ({
    page,
    context,
  }) => {
    await signIn(page);
    await page.goto("/admin/listening");

    const marker = `Heard in testing ${Date.now()}`;
    await page.fill("#listening-summary", "A session the tests ran.");
    await page.fill("#listening-count", "14");
    await page.fill("#heard-0", marker);
    await page.click('.admin-form button[type=submit]');
    await expect(page.locator(".toast")).toContainText("saved as draft");

    const pub = await context.newPage();
    await pub.goto("/listening");
    await expect(pub.getByText(marker)).toHaveCount(0);
  });

  test("a listening summary needs at least one thing heard", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/listening");
    await page.fill("#listening-summary", "Nothing recorded.");
    await page.click('.admin-form button[type=submit]');
    await expect(page.locator(".field-error")).toContainText("at least one thing you heard");
  });

  test("a correction publishes straight to the public log", async ({ page, context }) => {
    await signIn(page);
    await page.goto("/admin/corrections");

    const what = `A figure read wrong ${Date.now()}`;
    await page.fill("#correction-page", "/reports/2026-toledo-teacher-pay-report");
    await page.fill("#correction-what", what);
    await page.fill("#correction-why", "A reader pointed it out.");
    await page.click('.admin-form button[type=submit]');
    await expect(page.locator(".toast")).toContainText("Correction published.");

    const pub = await context.newPage();
    await pub.goto("/corrections");
    await expect(pub.getByText(what)).toBeVisible();
  });

  test("a correction cannot be logged without a reason", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/corrections");
    await page.fill("#correction-page", "/about");
    await page.fill("#correction-what", "Something changed");
    // why is required by the browser too, so the field is the first gate.
    expect(await page.$eval("#correction-why", (el: HTMLTextAreaElement) => el.validity.valid)).toBe(
      false,
    );
  });

  test("the about page lists staff and council from the database", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1")).toContainText("We read what nobody has time to read");
    await expect(page.getByRole("heading", { name: "Advisory Council" })).toBeVisible();
    await expect(page.getByText("Sample Council Member")).toBeVisible();
    // A council member's address is never published.
    expect(await page.content()).not.toContain("council-one@example.com");
  });

  test("a setting saved in admin shows on the public site", async ({ page, context }) => {
    await signIn(page);
    await page.goto("/admin/settings");

    const ein = `48-${Date.now().toString().slice(-7)}`;
    await page.fill("#setting-org_ein", ein);
    await page.click('.admin-form button[type=submit]');
    await expect(page.locator(".toast")).toContainText("saved");

    const pub = await context.newPage();
    await pub.goto("/about");
    // It reaches both the page body and the footer, which share the setting.
    await expect(pub.locator("main").getByText(ein, { exact: false })).toBeVisible();
    await expect(pub.locator("footer").getByText(ein, { exact: false })).toBeVisible();
  });
});
