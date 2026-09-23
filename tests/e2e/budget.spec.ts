/**
 * The City Budget Explorer, from an empty table to a loaded one.
 *
 * The order inside this file matters: the empty state is checked before
 * anything is uploaded, because an empty table has to be a page that says so
 * rather than a page that fails. Playwright runs one worker in file order, so
 * the sequence holds.
 */
import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("city budget", () => {
  test("says so, rather than failing, when nothing is loaded", async ({ page }) => {
    const response = await page.goto("/budget");
    // The part that matters on any run: the page exists whether or not a budget
    // does. It used to be that an unfilled table failed the build outright.
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("Where does Toledo");

    // The empty state itself can only be seen on a freshly seeded database,
    // since the test below this one loads a budget and never deletes it.
    const alreadyLoaded = await page.locator(".budget-explorer").count();
    test.skip(
      alreadyLoaded > 0,
      "a city budget is already loaded here. Re-run scripts/local-supabase.sh to cover the empty state.",
    );
    await expect(page.locator(".explorer-section")).toContainText(
      "The city budget has not been loaded yet.",
    );
  });

  test("a row with no source link is refused", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/explorer");

    const uploader = page.locator(".uploader").filter({ hasText: "City budget" });
    await uploader.locator('input[type="file"]').setInputFiles(
      "data/samples/city_budget_missing_source.csv",
    );
    await expect(uploader.locator(".preview")).toContainText("Nothing was imported");
    await expect(uploader.locator(".preview .data-table tbody tr").first()).toContainText(
      "link to the document",
    );
    await expect(uploader.locator('button:has-text("Commit")')).toHaveCount(0);
  });

  test("a good file previews, then commits", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/explorer");

    const budget = page.locator(".uploader").filter({ hasText: "City budget" });
    await budget.locator('input[type="file"]').setInputFiles("data/samples/city_budget.csv");
    await expect(budget.locator(".diff")).toBeVisible();
    await expect(budget.locator(".preview")).toContainText("16 rows read");
    await budget.locator('button:has-text("Commit")').click();
    await expect(page.locator(".toast")).toContainText("City budget updated");

    await page.goto("/admin/explorer");
    const population = page.locator(".uploader").filter({ hasText: "City population" });
    await population
      .locator('input[type="file"]')
      .setInputFiles("data/samples/city_population.csv");
    await expect(population.locator(".diff")).toBeVisible();
    await population.locator('button:has-text("Commit")').click();
    await expect(page.locator(".toast")).toContainText("City population updated");
  });

  test("departments, one percent, per resident and year over year", async ({ page }) => {
    await page.goto("/budget");

    // The General Fund and the newest year are what a reader lands on.
    await expect(page.locator("#budget-fund")).toHaveValue("General Fund");
    await expect(page.locator("#budget-year")).toHaveValue("2026");

    // Panel 1: departments, largest first, each amount linking to the book.
    const rows = page.locator(".budget-bars li");
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText("Police");
    await expect(rows.first()).toContainText("$104,000,000");
    await expect(rows.first()).toContainText("% of the fund");
    await expect(rows.first()).toContainText("page 118");
    await expect(rows.first().locator("a.src")).toHaveAttribute("title", "Links to source document.");

    // Panel 2: one percent of $208,440,000 is $2,084,400, which covers the
    // Clerk of Council outright and does not cover Forestry.
    await expect(page.locator("#budget-share-figure")).toHaveText("$2,084,400");
    const exceeds = page.locator(".budget-exceeds li");
    await expect(exceeds).toHaveCount(1);
    await expect(exceeds.first()).toContainText("Clerk of Council");

    // The slider moves the figure and the list with it.
    await page.locator("#budget-share").fill("2");
    await expect(page.locator("#budget-share-figure")).toHaveText("$4,168,800");
    await expect(page.locator(".budget-exceeds li")).toHaveCount(2);
    await expect(page.getByText("If 2 percent moved, it would equal")).toBeVisible();

    // Panel 3: per resident, with both documents linked under it.
    const perResident = page.locator(".budget-panel").filter({ hasText: "Per resident" });
    await expect(perResident.locator(".big")).toHaveText("$786");
    await expect(perResident).toContainText("265,300");
    expect(await perResident.locator("a.src").count()).toBe(2);

    // Panel 4: two years are loaded, so the trend is drawn.
    const trend = page.locator(".budget-panel").filter({ hasText: "Year over year" });
    await expect(trend.locator("#budget-department")).toHaveValue("Police");
    await trend.locator(".chart-toggle").click();
    await expect(trend.locator("tbody tr")).toHaveCount(2);
    await expect(trend.locator("tbody tr").first()).toContainText("2025");

    // Switching fund switches the whole page with it.
    await page.selectOption("#budget-fund", "Capital Improvements");
    await expect(page.locator(".budget-bars li")).toHaveCount(2);
    await expect(page.locator(".budget-bars li").first()).toContainText("Streets");
    // One year of that fund is loaded, so no trend is claimed.
    await expect(page.locator(".budget-panel").filter({ hasText: "Year over year" })).toHaveCount(0);
  });

  test("the home page lists four programs, the budget among them", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".program")).toHaveCount(4);
    const budget = page.locator(".program").filter({ hasText: "City Budget Explorer" });
    await expect(budget).toContainText("Every figure sourced.");
    await budget.locator("a.more").click();
    await expect(page).toHaveURL(/\/budget$/);
  });
});
