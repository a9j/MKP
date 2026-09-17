/**
 * WCAG 2.1 A and AA over every screen, in light and dark, at phone width.
 *
 * axe cannot prove a page is usable, but it catches the failures that are
 * mechanical: an unlabelled control, a heading level skipped, a contrast ratio
 * under the bar. Those are the ones that creep back in as screens change.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { signIn } from "./helpers";

const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const PUBLIC_PAGES = [
  "/",
  "/explorer",
  "/reports",
  "/records",
  "/votes",
  "/votes/members",
  "/listening",
  "/about",
  "/get-involved",
  "/contact",
  "/corrections",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/votes",
  "/admin/meetings",
  "/admin/records",
  "/admin/reports",
  "/admin/listening",
  "/admin/explorer",
  "/admin/people",
  "/admin/corrections",
  "/admin/subscribers",
  "/admin/settings",
];

type Violation = { id: string; impact: string | null; nodes: { target: string[] }[] };

async function violations(page: import("@playwright/test").Page): Promise<Violation[]> {
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above, not imported.
    return await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
  });
  return (result as { violations: Violation[] }).violations;
}

function describe(found: Violation[]): string {
  return found
    .map((v) => `${v.id} (${v.impact}) at ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
}

test.describe("accessibility", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`public pages have no violations in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const path of PUBLIC_PAGES) {
        await page.goto(path);
        const found = await violations(page);
        expect(found, `${path} in ${scheme} mode:\n${describe(found)}`).toEqual([]);
      }
    });
  }

  test("public pages have no violations at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of PUBLIC_PAGES) {
      await page.goto(path);
      const found = await violations(page);
      expect(found, `${path} at 390px:\n${describe(found)}`).toEqual([]);
    }
  });

  test("admin screens have no violations", async ({ page }) => {
    await signIn(page);
    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      const found = await violations(page);
      expect(found, `${path}:\n${describe(found)}`).toEqual([]);
    }
  });

  test("the draft review screen has no violations", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin");
    await page.locator(".review-list a").first().click();
    const found = await violations(page);
    expect(found, `the draft review screen:\n${describe(found)}`).toEqual([]);
  });
});
