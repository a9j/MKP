import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { signIn } from "./helpers";

const PDF = {
  name: "report.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF"),
};

function latestEmail(): { to: string[]; subject: string; text: string; html: string } | null {
  const dir = ".local-storage/emails";
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).sort();
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(`${dir}/${files[files.length - 1]}`, "utf8"));
}

test.describe("reports", () => {
  test("a draft stays off the public site and its preview link works without a login", async ({
    page,
    context,
  }) => {
    await signIn(page);
    await page.goto("/admin/reports");

    const title = `Draft under review ${Date.now()}`;
    await page.fill("#report-title", title);
    await page.fill("#report-summary", "A **draft** the council has not read yet.");
    await page.selectOption("#report-type", "levy_explainer");
    await page.fill("#source-label-0", "County levy filing");
    await page.fill("#source-url-0", "https://example.com/levy.pdf");
    await page.setInputFiles("#report-pdf", PDF);
    // Status is left on Draft.
    await page.click('.admin-form button[type=submit]');
    await expect(page.locator(".toast")).toContainText("Report saved as draft.");

    // It must not be on the public list, and its address must not resolve.
    const pub = await context.newPage();
    await pub.goto("/reports");
    await expect(pub.locator(".report-row").filter({ hasText: title })).toHaveCount(0);

    // Open it for editing to reach the preview link.
    await page.goto("/admin/reports");
    await page.locator("tr", { hasText: title }).getByRole("link", { name: "Edit" }).click();
    const previewUrl = await page.locator(".preview-url a").getAttribute("href");
    expect(previewUrl).toMatch(/\/reports\/preview\/[0-9a-f-]{36}$/);

    // A reader with no session can open it.
    const anonymous = await (await page.context().browser()!.newContext()).newPage();
    const response = await anonymous.goto(previewUrl!);
    expect(response?.status()).toBe(200);
    await expect(anonymous.locator("h1")).toContainText(title);
    await expect(anonymous.locator(".preview-banner")).toContainText("Draft preview");
    await expect(anonymous.locator(".sources-list")).toContainText("County levy filing");
    // And it is told not to index the page.
    expect(await anonymous.locator('meta[name="robots"]').getAttribute("content")).toContain(
      "noindex",
    );
  });

  test("a made up preview token is not found", async ({ page }) => {
    const response = await page.goto("/reports/preview/11111111-1111-4111-a111-111111111111");
    expect(response?.status()).toBe(404);
  });

  test("a report needs at least one source", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/reports");

    await page.fill("#report-title", "A report with nothing behind it");
    await page.fill("#report-summary", "No sources given.");
    // Label and link both left blank.
    await page.click('.admin-form button[type=submit]');

    await expect(page.locator(".toast")).toContainText("Nothing was saved");
    await expect(page.locator(".field-error").first()).toContainText("at least one source");
  });

  test("the address is derived from the title and shown before publishing", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/reports");

    await page.fill("#report-title", "The 2027 Toledo Teacher Pay Report");
    await expect(page.locator("#report-slug-preview")).toContainText(
      "/reports/the-2027-toledo-teacher-pay-report",
    );
  });

  test("send to council writes to every advisory member", async ({ page }) => {
    rmSync(".local-storage/emails", { recursive: true, force: true });

    await signIn(page);
    await page.goto("/admin/reports");
    await page.locator("tr", { hasText: "Draft levy explainer" }).getByRole("link", { name: "Edit" }).click();

    await page.click('button:has-text("Send to council")');
    await expect(page.locator(".toast")).toContainText("council member");

    const email = latestEmail();
    expect(email).not.toBeNull();
    // Both seeded council members, and nobody else.
    expect(email!.to.sort()).toEqual(["council-one@example.com", "council-two@example.com"]);
    expect(email!.subject).toContain("For review");
    expect(email!.text).toContain("/reports/preview/");
    // The house layout: a gold rule under the title.
    expect(email!.html).toContain("#D9A441");
  });

  test("publishing puts a report on the list and on its own page", async ({ page, context }) => {
    await signIn(page);
    await page.goto("/admin/reports");

    const title = `Published report ${Date.now()}`;
    await page.fill("#report-title", title);
    await page.fill("#report-summary", "What the records say, in **four minutes**.");
    await page.selectOption("#report-type", "pay_report");
    await page.fill("#source-label-0", "TPS certified salary schedule");
    await page.fill("#source-url-0", "https://example.com/schedule.pdf");
    await page.click('button:has-text("Add another source")');
    await page.fill("#source-label-1", "TPS Five Year Forecast");
    await page.fill("#source-url-1", "https://example.com/forecast.pdf");
    await page.setInputFiles("#report-pdf", PDF);
    await page.selectOption("#report-status", "published");
    await page.click('.admin-form button[type=submit]');
    await expect(page.locator(".toast")).toContainText("Report published.");

    const pub = await context.newPage();
    await pub.goto("/reports");
    const row = pub.locator(".report-row").filter({ hasText: title });
    await expect(row).toBeVisible();

    // The sources expander lists both, with links.
    await row.locator("summary").click();
    await expect(row.locator(".sources-list li")).toHaveCount(2);

    await row.getByRole("link", { name: title }).click();
    await expect(pub.locator("h1")).toContainText(title);
    // The summary is markdown, rendered.
    await expect(pub.locator(".report-summary strong")).toContainText("four minutes");
    // Every source is a gold underlined link to its document.
    const sourced = pub.locator(".sources-list a.src");
    await expect(sourced).toHaveCount(2);
    expect(await sourced.first().getAttribute("title")).toBe("Links to source document.");
    await expect(pub.getByRole("link", { name: "Download the PDF" })).toBeVisible();
    await expect(pub.getByRole("link", { name: "Request a briefing" })).toHaveAttribute(
      "href",
      /^mailto:hello@monakproject\.org/,
    );

    // And it reaches the home page feed.
    await pub.goto("/");
    await expect(pub.locator(".item .t").filter({ hasText: title })).toBeVisible();
  });
});
