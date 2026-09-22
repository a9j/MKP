/**
 * Compares the built home page against mona-k-homepage-mockup.html and fails
 * if any tracked element differs in size.
 *
 * The mockup pulls Instrument Sans from the Google Fonts CDN. Where that is
 * unreachable the mockup silently falls back to a system font and every
 * measurement drifts, so this script serves the mockup from a local origin and
 * proxies the app's self hosted font files to it. Both pages then render with
 * the same font and the comparison is real.
 *
 * Usage: pnpm build && pnpm start -p 3100, then node scripts/visual-parity.mjs
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = process.env.APP_URL ?? "http://localhost:3100";
const PORT = Number(process.env.PARITY_PORT ?? 3199);
const CHROME = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const ELEMENTS = {
  h1: "h1",
  lede: ".lede",
  button: ".actions .btn",
  explorer: ".explorer",
  bigFigure: ".big",
  sectionHeading: "section.wrap h2",
  // The program card is deliberately no longer the mockup's. Phase 2 makes the
  // list four items rather than three, so the card is a quarter of the row
  // instead of a third. The row it sits in is still tracked, since that is what
  // the mockup fixes: the grid's width and its hairline rules, not how many
  // columns the organization happens to run.
  programsRow: { selector: ".programs", compare: "width" },
  step: ".step",
  feedRow: ".item",
  cta: ".cta",
  footer: "footer .foot",
};

const mockup = readFileSync(join(ROOT, "mona-k-homepage-mockup.html"), "utf8");

// Serves the mockup and proxies /_next/* to the app, so the font files the
// mockup loads are same origin and are not blocked by CORS.
const server = createServer(async (req, res) => {
  if (req.url.startsWith("/_next/")) {
    const upstream = await fetch(APP + req.url);
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    });
    res.end(body);
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(mockup);
});
await new Promise((r) => server.listen(PORT, r));

// Recover the @font-face rules next/font generated for the app.
const appHtml = await (await fetch(APP + "/")).text();
let fontCss = "";
for (const href of [...appHtml.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map((m) => m[1])) {
  const css = await (await fetch(APP + href)).text();
  if (css.includes("@font-face")) fontCss += css;
}
if (!fontCss) {
  console.error("Could not find the app's @font-face rules. Is the app running?");
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--proxy-bypass-list=<-loopback>"],
});

async function measure(url, injectCss) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  if (injectCss) await page.addStyleTag({ content: injectCss });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const out = await page.evaluate((els) => {
    const r = {};
    for (const [name, spec] of Object.entries(els)) {
      const el = document.querySelector(typeof spec === "string" ? spec : spec.selector);
      if (!el) { r[name] = null; continue; }
      const box = el.getBoundingClientRect();
      r[name] = { w: Math.round(box.width), h: Math.round(box.height) };
    }
    return r;
  }, ELEMENTS);
  await page.close();
  return out;
}

const fromMockup = await measure(`http://localhost:${PORT}/`, fontCss);
const fromApp = await measure(APP + "/", null);
await browser.close();
server.close();

let failed = 0;
console.log("element".padEnd(16), "mockup".padEnd(12), "built".padEnd(12), "result");
for (const name of Object.keys(ELEMENTS)) {
  const a = fromMockup[name];
  const b = fromApp[name];
  if (!a || !b) {
    console.log(name.padEnd(16), "-".padEnd(12), "-".padEnd(12), "MISSING");
    failed++;
    continue;
  }
  // A tracked element may fix its width only, where the page deliberately
  // carries different content from the mockup and so a different height.
  const spec = ELEMENTS[name];
  const widthOnly = typeof spec !== "string" && spec.compare === "width";
  const same = a.w === b.w && (widthOnly || a.h === b.h);
  if (!same) failed++;
  console.log(
    name.padEnd(16),
    (widthOnly ? `${a.w} wide` : `${a.w}x${a.h}`).padEnd(12),
    (widthOnly ? `${b.w} wide` : `${b.w}x${b.h}`).padEnd(12),
    same ? "match" : "DIFFERS",
  );
}

if (failed > 0) {
  console.error(`\n${failed} element(s) differ from the mockup.`);
  process.exit(1);
}
console.log("\nAll tracked elements match the mockup.");
