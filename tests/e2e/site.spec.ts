import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe("public pages", () => {
  const pages = [
    { path: "/", heading: /The records are public/ },
    { path: "/explorer", heading: /What do you actually make/ },
    { path: "/records", heading: /starts with a public records request/ },
    { path: "/votes", heading: /What the board decided/ },
    { path: "/votes/members", heading: /Voting records by member/ },
  ];

  for (const { path, heading } of pages) {
    test(`${path} renders`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toContainText(heading);
      // The nav and footer come from the public layout, not the admin shell.
      await expect(page.locator("nav.site-nav")).toBeVisible();
      await expect(page.locator("footer.site-footer")).toBeAttached();
    });
  }

  test("no horizontal scroll on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const { path } of pages) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${path} scrolls sideways`).toBe(false);
    }
  });
});

test.describe("explorer", () => {
  test("the figure changes when an input changes", async ({ page }) => {
    await page.goto("/");
    const figure = page.locator("#explorer .big");
    const before = await figure.textContent();

    await page.selectOption("#explorer-step", "20");
    // The salary animates over 400ms, so settle before reading it.
    await page.waitForTimeout(900);

    const after = await figure.textContent();
    expect(after).not.toBe(before);
    expect(after).toMatch(/^\$[\d,]+$/);
  });

  test("a district with different lane names is not guessed at", async ({ page }) => {
    await page.goto("/");
    await page.selectOption("#explorer-district", "Springfield");
    await expect(page.locator("#explorer .rows .row").first()).toContainText(
      "Not directly comparable",
    );
  });

  test("every figure on the explorer links to a source", async ({ page }) => {
    await page.goto("/explorer");
    await page.locator(".chart-toggle").click();
    const sourced = page.locator(".chart .data-table a.src");
    expect(await sourced.count()).toBeGreaterThan(0);
    for (const link of await sourced.all()) {
      expect(await link.getAttribute("href")).toMatch(/^https?:\/\//);
      expect(await link.getAttribute("title")).toBe("Links to source document.");
    }
  });
});

test.describe("admin access", () => {
  test("an admin page redirects to sign in", async ({ page }) => {
    await page.goto("/admin/votes");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page).toHaveURL(/next=%2Fadmin%2Fvotes/);
  });

  test("there is no password field anywhere in sign in", async ({ page }) => {
    await page.goto("/admin/login");
    expect(await page.locator('input[type="password"]').count()).toBe(0);
  });

  test("a signed in address that is not an administrator is refused", async ({ page }) => {
    await signIn(page, "stranger@example.com");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator(".login-error")).toContainText("not on the administrator list");
  });

  test("a sign in link only works once", async ({ page, context }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/admin/);

    const usedLink = page.url();
    const second = await context.newPage();
    await second.goto(usedLink);
    // Re-following the consumed link lands back on sign in, not in the panel.
    await expect(second).toHaveURL(/\/admin/);
  });
});

test.describe("posting a vote", () => {
  test("a vote created in admin appears on /votes and in the Latest feed", async ({
    page,
    context,
  }) => {
    await signIn(page);
    await page.goto("/admin/votes");

    // The default body must have a roll call, or the form opens unusable.
    await page.waitForSelector(".rollcall-row");
    const memberCount = await page.locator(".rollcall-row").count();
    expect(memberCount).toBeGreaterThan(0);
    await expect(page.locator(".tally-line")).toContainText(`${memberCount} yes`);

    const title = `Playwright test vote ${Date.now()}`;
    await page.fill("#vote-title", title);
    await page.fill("#vote-summary", "The board approved a purchase for the test suite.");
    await page.selectOption("#vote-category", "facilities");
    await page.fill("#vote-amount", "$12,345");

    // Flip one member to No, and check the tally follows.
    await page.locator('.rollcall-row').first().getByRole("radio", { name: "No" }).click();
    await expect(page.locator(".tally-line")).toContainText(`${memberCount - 1} yes, 1 no`);

    await page.click(".vote-form button[type=submit]");
    await expect(page.locator(".toast")).toContainText("Vote published.");

    const pub = await context.newPage();
    await pub.goto("/votes");
    await expect(pub.locator(".vote h3").filter({ hasText: title })).toBeVisible();

    const entry = pub.locator(".vote").filter({ hasText: title });
    await expect(entry).toContainText(`${memberCount - 1} yes, 1 no`);
    await expect(entry).toContainText("$12,345");

    // Filters narrow the log.
    await pub.click('.filter:has-text("Facilities")');
    await expect(pub.locator(".vote h3").filter({ hasText: title })).toBeVisible();
    await pub.click('.filter:has-text("Staffing")');
    await expect(pub.locator(".vote h3").filter({ hasText: title })).toHaveCount(0);

    // And it reaches the home page feed, which is statically rendered, so this
    // also proves revalidatePath ran on save.
    await pub.goto("/");
    await expect(pub.locator(".item .t").filter({ hasText: title })).toBeVisible();
  });

  test("a summary over the limit is refused", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/votes");
    await page.waitForSelector(".rollcall-row");

    const counter = page.locator("#vote-summary-count");
    await expect(counter).toContainText("200 characters left");
    await page.fill("#vote-summary", "x".repeat(150));
    await expect(counter).toContainText("50 characters left");

    // The field itself stops at the limit, so the count can never go negative.
    await page.fill("#vote-summary", "x".repeat(260));
    expect((await page.inputValue("#vote-summary")).length).toBe(200);
  });
});

test.describe("records desk", () => {
  test("a denial must record the reason, and only then", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/records");

    await expect(page.locator("#record-denial")).toHaveCount(0);
    await page.selectOption("#record-status", "denied");
    await expect(page.locator("#record-denial")).toBeVisible();

    await page.selectOption("#record-status", "fulfilled");
    await expect(page.locator("#record-denial")).toHaveCount(0);
  });

  test("a file that is not a PDF is refused", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/records");

    await page.fill("#record-text", "A request the test suite filed");
    await page.fill("#record-filed", "2026-09-01");
    await page.setInputFiles("#record-docs", {
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a pdf"),
    });
    await page.click(".admin-form button[type=submit]");

    await expect(page.locator(".toast")).toContainText("Nothing was saved");
    await expect(page.locator(".field-error")).toContainText("not a PDF");
  });

  test("the public log shows response time in business days", async ({ page }) => {
    await page.goto("/records");
    const table = page.locator(".records-table");
    await expect(table).toBeVisible();
    await expect(table).toContainText("business day");
    // An unanswered request says so rather than showing a zero.
    await expect(table).toContainText("No response yet");
  });
});

test.describe("explorer csv upload", () => {
  test("a salary CSV with a missing source_url is rejected with a clear message", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/explorer");

    await page.setInputFiles('input[type="file"]', "data/samples/salary_schedule_missing_source.csv");
    await expect(page.locator(".preview")).toBeVisible();
    await expect(page.locator(".preview")).toContainText("Nothing was imported");

    const problems = page.locator(".preview .data-table tbody tr");
    await expect(problems).toHaveCount(1);
    await expect(problems.first()).toContainText("3");
    await expect(problems.first()).toContainText("source_url");
    await expect(problems.first()).toContainText("link to the document");

    // No commit button is offered for a file that cannot be imported.
    await expect(page.locator('button:has-text("Commit")')).toHaveCount(0);
  });

  test("a valid CSV previews with a diff before anything is written", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/explorer");

    await page.setInputFiles('input[type="file"]', "data/samples/salary_schedule.csv");
    await expect(page.locator(".diff")).toBeVisible();
    await expect(page.locator(".preview")).toContainText("18 rows read");
    await expect(page.locator('button:has-text("Commit")')).toBeVisible();
  });
});
