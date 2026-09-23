/**
 * Runs Lighthouse over every public route in mobile emulation and fails if any
 * category falls below the bar.
 *
 *   pnpm build && pnpm start -p 3100
 *   pnpm test:lighthouse
 *
 * Mobile is the case that matters: the brief asks for 95 or above on
 * Performance, Accessibility, Best Practices and SEO for every public route on
 * mobile, which is the slower of the two and the one most readers will use.
 */
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const BASE = process.env.LH_BASE_URL ?? "http://localhost:3100";
const THRESHOLD = Number(process.env.LH_THRESHOLD ?? 95);
const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const ROUTES = [
  "/",
  "/explorer",
  "/budget",
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

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

const chrome = await launch({
  chromePath: CHROME,
  chromeFlags: [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--proxy-bypass-list=<-loopback>",
  ],
});

const rows = [];
let failures = 0;

try {
  for (const route of ROUTES) {
    const result = await lighthouse(
      BASE + route,
      { port: chrome.port, output: "json", logLevel: "error" },
      {
        extends: "lighthouse:default",
        settings: { formFactor: "mobile", screenEmulation: { mobile: true } },
      },
    );

    const scores = Object.fromEntries(
      CATEGORIES.map((key) => [key, Math.round((result.lhr.categories[key]?.score ?? 0) * 100)]),
    );
    const worst = Math.min(...Object.values(scores));
    if (worst < THRESHOLD) failures++;

    rows.push({ route, ...scores, pass: worst >= THRESHOLD });

    // Name what is costing points, so a failure is actionable rather than a number.
    if (worst < THRESHOLD) {
      for (const key of CATEGORIES) {
        if (scores[key] >= THRESHOLD) continue;
        const audits = Object.values(result.lhr.audits)
          .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "notApplicable")
          .slice(0, 6);
        console.log(`\n  ${route} ${key} = ${scores[key]}`);
        for (const audit of audits) {
          console.log(`    - ${audit.id}: ${audit.title}`);
        }
      }
    }
  }
} finally {
  await chrome.kill();
}

console.log(
  "\nroute".padEnd(20) +
    CATEGORIES.map((c) => c.slice(0, 5).padStart(8)).join("") +
    "   result",
);
for (const row of rows) {
  console.log(
    row.route.padEnd(20) +
      CATEGORIES.map((c) => String(row[c]).padStart(8)).join("") +
      (row.pass ? "   pass" : "   FAIL"),
  );
}

if (failures > 0) {
  console.error(`\n${failures} route(s) scored below ${THRESHOLD}.`);
  process.exit(1);
}
console.log(`\nAll ${ROUTES.length} public routes scored ${THRESHOLD} or above on mobile.`);
