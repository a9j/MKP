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
    // An explainer answers its three questions before it saves, draft or not.
    await page.fill("#report-asksFor", "A 4.9 mill operating levy for five years.");
    await page.fill("#report-funds", "Day to day operations.");
    await page.fill("#report-ifFails", "The forecast shows a deficit in year two.");
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

test.describe("ballot explainers", () => {
  const future = "2027-11-02";

  test("an explainer will not save without its three answers", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/reports");

    // The fields appear only for an explainer, so a pay report never sees them.
    await expect(page.locator("#report-asksFor")).toHaveCount(0);
    await page.selectOption("#report-type", "ballot_explainer");
    await expect(page.locator("#report-asksFor")).toBeVisible();
    await expect(page.locator("#report-funds")).toBeVisible();
    await expect(page.locator("#report-ifFails")).toBeVisible();

    await page.fill("#report-title", `Issue 3 ${Date.now()}`);
    await page.fill("#report-summary", "A ballot issue the test suite wrote.");
    await page.fill("#source-label-0", "County board of elections");
    await page.fill("#source-url-0", "https://example.com/ballot.pdf");
    // Two of the three, so the third has to be what stops it.
    await page.fill("#report-asksFor", "A 1 mill levy for five years.");
    await page.fill("#report-funds", "Branch hours and materials.");
    await page.click(".admin-form button[type=submit]");

    await expect(page.locator(".toast")).toContainText("Nothing was saved");
    await expect(page.locator(".field-error")).toContainText("what happens if it fails");
  });

  test("a homeowner figure has to name the auditor", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/reports");
    await page.selectOption("#report-type", "ballot_explainer");

    await page.fill("#report-title", `Issue 4 ${Date.now()}`);
    await page.fill("#report-summary", "A ballot issue the test suite wrote.");
    await page.fill("#source-label-0", "County board of elections");
    await page.fill("#source-url-0", "https://example.com/ballot.pdf");
    await page.fill("#report-asksFor", "A 1 mill levy for five years.");
    await page.fill("#report-funds", "Branch hours and materials.");
    await page.fill("#report-ifFails", "The levy expires.");
    await page.fill("#report-homeownerCost", "About fifty dollars a year.");
    await page.click(".admin-form button[type=submit]");

    await expect(page.locator(".field-error")).toContainText("auditor");
  });

  test("an election date and an issue number travel together", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/reports");
    await page.selectOption("#report-type", "ballot_explainer");

    await page.fill("#report-title", `Issue 5 ${Date.now()}`);
    await page.fill("#report-summary", "A ballot issue the test suite wrote.");
    await page.fill("#source-label-0", "County board of elections");
    await page.fill("#source-url-0", "https://example.com/ballot.pdf");
    await page.fill("#report-asksFor", "A 1 mill levy.");
    await page.fill("#report-funds", "Branch hours.");
    await page.fill("#report-ifFails", "The levy expires.");
    await page.fill("#report-ballot-date", future);
    // Deliberately no issue number.
    await page.click(".admin-form button[type=submit]");

    await expect(page.locator(".field-error")).toContainText("issue number");
  });

  test("a published explainer reaches the ballot group, the strip and its page", async ({
    page,
    context,
  }) => {
    await signIn(page);
    await page.goto("/admin/reports");
    await page.selectOption("#report-type", "ballot_explainer");

    const stamp = Date.now();
    const title = `Issue 7 test explainer ${stamp}`;
    await page.fill("#report-title", title);
    await page.fill("#report-summary", "A ballot issue the test suite published.");
    await page.fill("#source-label-0", "County board of elections");
    await page.fill("#source-url-0", "https://example.com/ballot.pdf");
    await page.fill("#report-asksFor", "A 1 mill levy for five years.");
    await page.fill("#report-funds", "Branch hours and materials.");
    await page.fill("#report-ifFails", "The levy expires at the end of next year.");
    await page.fill(
      "#report-homeownerCost",
      "The county auditor's certification states $35 a year on a $100,000 home.",
    );
    await page.fill("#report-ballot-date", future);
    await page.fill("#report-issue-number", "Issue 7");
    await page.selectOption("#report-status", "published");
    await page.click(".admin-form button[type=submit]");
    await expect(page.locator(".toast")).toContainText("Report published");

    const pub = await context.newPage();

    // The grouping, under a heading carrying the election date.
    await pub.goto("/reports");
    const section = pub.locator("#on-the-ballot");
    await expect(section.locator("h2").first()).toContainText("On the ballot,");

    // Each election gets its own heading and its own list, and within one list
    // the issues are in numeric order: 7 above 12, which a string sort misses.
    const group = section.locator(`.ballot-group[data-ballot-date="${future}"]`);
    await expect(group.locator("li").filter({ hasText: title })).toHaveCount(1);
    const issues = await group.locator(".ballot-issue").allTextContents();
    const numbers = issues.map((text) => Number(text.replace(/\D/g, "")));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));

    // The home page strip, which only exists while an election is coming.
    await pub.goto("/");
    const strip = pub.locator(".ballot-strip");
    // The site sets a typographic apostrophe, as it does in every other string.
    await expect(strip).toContainText("Read what’s on the ballot.");
    await strip.locator("a").click();
    await expect(pub).toHaveURL(/\/reports#on-the-ballot$/);

    // The page itself: the same headings in the same order, every time.
    await pub.goto("/reports");
    await pub.locator(".ballot-list a").filter({ hasText: title }).click();
    // allTextContents does not wait for the navigation the click started, so
    // settle on the new page before reading it.
    await expect(pub.locator(".explainer-section h2").first()).toBeVisible();
    const headings = await pub.locator(".explainer-section h2").allTextContents();
    expect(headings).toEqual([
      "What it asks for",
      "What it would fund",
      "What happens if it fails",
      "What it costs a homeowner",
    ]);
    await expect(pub.locator(".explainer")).toContainText("Issue 7");
    await expect(pub.locator(".explainer")).toContainText("auditor");
  });

  test("an explainer whose election has passed leaves the group and the strip", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/reports");
    await page.selectOption("#report-type", "ballot_explainer");

    const title = `Issue 99 last year ${Date.now()}`;
    await page.fill("#report-title", title);
    await page.fill("#report-summary", "An election that has already happened.");
    await page.fill("#source-label-0", "County board of elections");
    await page.fill("#source-url-0", "https://example.com/ballot.pdf");
    await page.fill("#report-asksFor", "A 1 mill levy.");
    await page.fill("#report-funds", "Branch hours.");
    await page.fill("#report-ifFails", "The levy expires.");
    await page.fill("#report-ballot-date", "2020-11-03");
    await page.fill("#report-issue-number", "Issue 99");
    await page.selectOption("#report-status", "published");
    await page.click(".admin-form button[type=submit]");
    await expect(page.locator(".toast")).toContainText("Report published");

    await page.goto("/reports");
    // Still a report, just not on the ballot any more.
    await expect(page.locator(".ballot-list").filter({ hasText: title })).toHaveCount(0);
    await expect(page.locator(".report-row").filter({ hasText: title })).toHaveCount(1);
  });
});
