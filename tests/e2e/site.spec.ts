import { test, expect } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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

  /**
   * Not scrolling sideways is not the same as fitting. The headline block sets
   * its own padding, which wiped out the gutter .wrap gives everything else, so
   * on a phone the first thing on every page ran to the edge of the screen
   * while the content under it did not. This asserts they line up.
   */
  test("the headline keeps the same gutter as the page under it", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const { path } of pages) {
      await page.goto(path);
      const gutters = await page.evaluate(() => {
        const left = (selector: string) => {
          const element = document.querySelector(selector);
          return element ? Math.round(element.getBoundingClientRect().left) : null;
        };
        return { head: left("h1"), body: left(".wrap:not(.page-head):not(.hero) h2, .filters") };
      });
      expect(gutters.head, `${path} has no headline`).not.toBeNull();
      expect(gutters.head!, `${path} headline touches the edge`).toBeGreaterThanOrEqual(16);
      if (gutters.body !== null) {
        expect(
          Math.abs(gutters.head! - gutters.body),
          `${path} headline and content start at different places`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  /** Eleven admin screens have to be reachable without a sideways swipe. */
  test("every admin tab is on screen on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.goto("/admin");

    const tabs = page.locator(".admin-rail li a");
    const count = await tabs.count();
    expect(count).toBeGreaterThan(8);
    for (let i = 0; i < count; i += 1) {
      const box = await tabs.nth(i).boundingBox();
      expect(box, `tab ${i} is not rendered`).not.toBeNull();
      expect(box!.x, `tab ${i} starts off screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `tab ${i} runs past the right edge`).toBeLessThanOrEqual(391);
    }
  });
});

test.describe("vote watch covers more than one body", () => {
  test("the body filter comes first and narrows the log", async ({ page }) => {
    await page.goto("/votes");

    // Body is the first control on the page, before the category pills.
    const labels = await page.locator(".filter-label").allTextContents();
    expect(labels[0]).toBe("Body");

    const groups = page.locator(".filters");
    await expect(groups.first().locator(".filter").first()).toHaveText("All bodies");
    await expect(groups.first()).toContainText("City Council");

    // Both bodies are in the log. The board's count depends on what the rest
    // of the suite has published, so only the council's is exact.
    await expect(page.locator(".vote-kind").filter({ hasText: "City Council" })).toHaveCount(1);
    expect(
      await page.locator(".vote-kind").filter({ hasText: "TPS Board" }).count(),
    ).toBeGreaterThan(0);

    await page.click('.filter:has-text("City Council")');
    await expect(page.locator(".vote-kind").filter({ hasText: "TPS Board" })).toHaveCount(0);
    await expect(page.locator(".vote-kind").filter({ hasText: "City Council" })).toHaveCount(1);

    // The two filters combine rather than replacing one another.
    await page.click('.filter:has-text("Staffing")');
    await expect(page.locator(".vote")).toHaveCount(0);
  });

  test("voting records are grouped by body, with council seats named", async ({ page }) => {
    await page.goto("/votes/members");

    const groups = page.locator(".member-group");
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0).locator("h2")).toHaveText("TPS Board");
    await expect(groups.nth(1).locator("h2")).toHaveText("City Council");

    // Council is twelve members, six of them holding a district.
    await expect(groups.nth(1).locator("tbody tr")).toHaveCount(12);
    await expect(groups.nth(1)).toContainText("District 3");
    await expect(groups.nth(1)).toContainText("At large");

    // The board does not use districts, so it has no seat column at all.
    await expect(groups.nth(0).locator("thead")).not.toContainText("Seat");
  });

  test("the Latest feed says which body voted", async ({ page }) => {
    await page.goto("/");
    // Which votes are in the six newest rows depends on what the rest of the
    // suite published, so every vote row is checked rather than one of them.
    const kinds = await page
      .locator('.latest .item[href="/votes"] .kind')
      .allTextContents();
    expect(kinds.length).toBeGreaterThan(0);
    for (const kind of kinds) {
      expect(kind).toMatch(/^(TPS Board|City Council|County) vote$/);
    }
  });

  test("a council roll call is grouped into at large and district seats", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/votes");
    await page.waitForSelector(".rollcall-row");

    const council = page.locator("#vote-meeting option", { hasText: "Toledo City Council" });
    await page.selectOption("#vote-meeting", await council.first().getAttribute("value") ?? "");
    await expect(page.locator(".rollcall-row")).toHaveCount(12);
    await expect(page.locator(".rollcall-heading")).toHaveText(["At large", "By district"]);
    await expect(page.locator(".rollcall-seat").first()).toHaveText("District 1");
    // Every seat still defaults to yes, council included.
    await expect(page.locator(".tally-line")).toContainText("12 yes");
  });
});

test.describe("home page", () => {
  test("hero, four tools, and the Explorer below Latest", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".home-hero h1")).toHaveText(
      "The records are public. We make them readable.",
    );
    const tools = page.locator("#tools .tool h3");
    await expect(tools).toHaveText([
      "Vote Watch",
      "Teacher Pay Explorer",
      "City Budget Explorer",
      "Records Desk",
    ]);
    await expect(page.locator("#explorer")).toBeVisible();

    // Document order, not screen position, so it holds at any width.
    const explorerFollowsLatest = await page.evaluate(() => {
      const latest = document.querySelector("#latest");
      const explorer = document.querySelector("#explorer");
      return Boolean(
        latest &&
          explorer &&
          latest.compareDocumentPosition(explorer) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
    expect(explorerFollowsLatest).toBe(true);
  });

  test("every image has alt text", async ({ page }) => {
    await page.goto("/");
    for (const img of await page.locator("img").all()) {
      const alt = (await img.getAttribute("alt")) ?? "";
      expect(alt.trim(), await img.getAttribute("src") ?? "img").not.toBe("");
    }
  });

  test("no photo is over 400 KB", () => {
    const dir = join(process.cwd(), "public/photos");
    for (const file of readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))) {
      const kb = statSync(join(dir, file)).size / 1024;
      expect(kb, `${file} is ${Math.round(kb)} KB`).toBeLessThanOrEqual(400);
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
    await expect(pub.locator(".vote .vote-heading").filter({ hasText: title })).toBeVisible();

    const entry = pub.locator(".vote").filter({ hasText: title });
    await expect(entry).toContainText(`${memberCount - 1} yes, 1 no`);
    await expect(entry).toContainText("$12,345");

    // Filters narrow the log.
    await pub.click('.filter:has-text("Facilities")');
    await expect(pub.locator(".vote .vote-heading").filter({ hasText: title })).toBeVisible();
    await pub.click('.filter:has-text("Staffing")');
    await expect(pub.locator(".vote .vote-heading").filter({ hasText: title })).toHaveCount(0);

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

test.describe("software collects and drafts, a person publishes", () => {
  // The development seed carries one machine written draft.
  const DRAFT_TITLE = "Renew transportation services agreement";

  test("an AI draft appears on no public page", async ({ page }) => {
    for (const path of ["/", "/votes", "/votes/members"]) {
      await page.goto(path);
      await expect(
        page.locator("body"),
        `${path} showed a vote nobody has reviewed`,
      ).not.toContainText(DRAFT_TITLE);
    }
  });

  test("the dashboard lists it as waiting, marked as unreviewed", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin");

    const item = page.locator(".review-list li").filter({ hasText: DRAFT_TITLE });
    await expect(item).toBeVisible();
    await expect(item.locator(".badge-ai")).toContainText("AI draft, unreviewed");
  });

  test("Publish stays disabled until the draft is checked against the document", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin");
    await page.locator(".review-list a").filter({ hasText: DRAFT_TITLE }).click();

    // The banner says what this is before any of the fields are read.
    await expect(page.locator(".draft-banner .badge-ai")).toContainText("AI draft, unreviewed");
    await expect(page.locator(".draft-banner")).toContainText("52 percent confidence");

    const publish = page.locator(".vote-form button[type=submit]");
    await expect(publish).toBeDisabled();

    // The source document is reachable from the gate, which is the thing the
    // admin is being asked to confirm they opened.
    await expect(page.locator(".review-gate a")).toHaveAttribute("href", /^https?:\/\//);

    // Saving it as a draft is always available. Publishing is not.
    await expect(page.locator(".vote-form .text-link")).toBeEnabled();

    await page.locator("#vote-checked").check();
    await expect(publish).toBeEnabled();

    await page.locator("#vote-checked").uncheck();
    await expect(publish).toBeDisabled();
  });
});
