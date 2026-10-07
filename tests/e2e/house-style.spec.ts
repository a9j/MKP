/**
 * The tells this site does not use.
 *
 * Every one of these is a decoration that reads as generic the moment you have
 * seen it twice, and a few cost something real: a blurred bar repaints on every
 * scroll frame, a hollow numeral disappears where its prefixed property is not
 * honoured, "01, 02" over four unordered items states a sequence that does not
 * exist. The CSS in this repo carries two separate comments saying a fix was
 * made once and came back with a redesign, so this is a test rather than a
 * note.
 *
 * It checks two places, because there are two ways in:
 *
 *   1. The authored stylesheet, src/app/globals.css. Reading the built bundle
 *      instead does not work: Tailwind ships definitions for utilities nobody
 *      uses, so the bundle contains the string "backdrop-filter" whether or not
 *      anything on the site is frosted.
 *   2. The computed style of every element the pages actually render, which is
 *      what catches the same decoration arriving as a Tailwind class in JSX.
 *
 * A legitimate use can be allowed by name here. The point is that it takes a
 * deliberate edit, not a quiet reappearance.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const PAGES = [
  "/",
  "/explorer",
  "/budget",
  "/reports",
  "/explainers",
  "/records",
  "/votes",
  "/about",
  "/get-involved",
  "/contact",
  "/corrections",
];

/**
 * The authored stylesheet with its comments stripped. The comments have to go:
 * several of them explain which decoration was removed and name the property it
 * used, so matching against the raw file fails on its own changelog.
 */
const AUTHORED = readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test.describe("house style, in the authored stylesheet", () => {
  test("no frosted glass, glow, gradient text or hollow numeral", () => {
    expect(AUTHORED, "frosted glass is back").not.toMatch(/backdrop-filter/i);
    expect(AUTHORED, "a hollow outlined numeral is back").not.toMatch(/text-stroke/i);
    expect(AUTHORED, "gradient text is back").not.toMatch(/background-clip:\s*text/i);
    expect(AUTHORED, "gradient text is back").not.toMatch(/text-fill-color/i);

    // A shadow with no offset is a halo. The site's shadows are hard offsets
    // and deliberate drop shadows, which all carry an offset.
    expect(AUTHORED, "a glow is back").not.toMatch(/box-shadow:\s*0\s+0\s+\d/i);
    expect(AUTHORED, "a blur filter is back").not.toMatch(/filter:\s*blur/i);
  });

  test("the palette and the typeface are the house ones", () => {
    expect(AUTHORED, "a purple or indigo entered the palette").not.toMatch(
      /\b(?:purple|violet|indigo|rebeccapurple)\b|#(?:7c3aed|6366f1|8b5cf6|a855f7|4f46e5|818cf8)\b/i,
    );
    expect(AUTHORED, "Inter appeared in a font stack").not.toMatch(/\bInter\b/);
    expect(AUTHORED, "beige appeared").not.toMatch(/\bbeige\b|#f5f5dc\b/i);

    // The lookbehind keeps "sans-serif" out: a hyphen is a word boundary, so a
    // bare \bserif\b matches every fallback stack on the site.
    expect(AUTHORED, "a serif stack appeared").not.toMatch(
      /font-family:[^;}]*(?<!sans-)\bserif\b/i,
    );
  });

  test("one animation on the site, and it is a transition", () => {
    // A pulsing dot needs a keyframe, so this covers it.
    expect(AUTHORED, "a keyframe animation was added").not.toMatch(/@keyframes/i);
  });
});

test.describe("house style, on the rendered pages", () => {
  test("nothing is frosted, glowing, hollow or gradient filled", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const found = await page.$$eval("body *", (nodes) =>
        nodes.flatMap((node) => {
          const s = getComputedStyle(node);
          const where = `${node.tagName.toLowerCase()}.${node.className || "(no class)"}`;
          const hits: string[] = [];
          if (s.backdropFilter && s.backdropFilter !== "none") hits.push(`frosted glass on ${where}`);
          if (/blur/.test(s.filter)) hits.push(`blur filter on ${where}`);
          if (parseFloat(s.webkitTextStrokeWidth || "0") > 0) hits.push(`text stroke on ${where}`);
          if (s.webkitBackgroundClip === "text" || s.backgroundClip === "text") {
            hits.push(`gradient text on ${where}`);
          }
          // rgb(...) 0px 0px Npx with no fourth length is a halo.
          if (/\)\s*0px\s+0px\s+\d/.test(s.boxShadow)) hits.push(`glow on ${where}`);
          if (s.animationName && s.animationName !== "none") {
            hits.push(`keyframe animation on ${where}`);
          }
          if (/\bInter\b/.test(s.fontFamily)) hits.push(`Inter on ${where}`);
          return hits;
        }),
      );
      expect(found, `${path}`).toEqual([]);
    }
  });

  test("no page numbers an unordered list of things with 01, 02", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      // A zero padded ordinal standing alone as its own visible element. A date
      // or a figure never appears alone in a leaf, so this only catches labels.
      const padded = await page.$$eval("body *", (nodes) =>
        nodes
          .filter((n) => n.children.length === 0)
          .map((n) => (n.textContent ?? "").trim())
          .filter((t) => /^0[1-9]$/.test(t)),
      );
      expect(padded, `${path} renders a zero padded ordinal label`).toEqual([]);
    }
  });

  test("no page carries marketing hype, an introducing badge or an em dash", async ({ page }) => {
    const hype =
      /\b(?:supercharge|unleash|revolutioniz|game.chang|cutting.edge|seamless|effortless|unlock the|next.level|elevate your|harness the power)\b/i;

    for (const path of PAGES) {
      await page.goto(path);
      const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");

      expect(text, `${path} uses marketing hype`).not.toMatch(hype);
      expect(text, `${path} contains an em dash`).not.toContain("—");
      expect(text, `${path} carries an introducing badge`).not.toMatch(/\bintroducing\b/i);
    }
  });
});
