import { test } from "node:test";
import assert from "node:assert/strict";
import { levyCost, parseMoney, LEVY_METHOD_NOTE, RENEWAL_NOTE } from "../src/lib/levy-math";
import { countSyllables, readingGrade } from "../src/lib/reading-grade";
import { explainerPath, isTemplate, EXPLAINER_NEUTRALITY } from "../src/lib/explainer-types";

test("the auditor's figure wins when it is set", () => {
  const cost = levyCost(250_000, { mills: 2.5, costPer100k: 87.5 });
  assert.ok(cost);
  assert.equal(cost.method, "auditor");
  assert.equal(cost.perYear, 218.75);
  assert.ok(Math.abs(cost.perMonth - 218.75 / 12) < 1e-9);
});

test("without it, the 35 percent formula applies", () => {
  // $100,000 x 0.35 x 2.5 / 1000 = $87.50
  const cost = levyCost(100_000, { mills: 2.5, costPer100k: null });
  assert.ok(cost);
  assert.equal(cost.method, "formula");
  assert.equal(cost.perYear, 87.5);
});

test("no millage and no auditor figure is no estimate", () => {
  assert.equal(levyCost(100_000, { mills: null, costPer100k: null }), null);
  assert.equal(levyCost(-5, { mills: 2, costPer100k: null }), null);
  assert.equal(levyCost(Number.NaN, { mills: 2, costPer100k: null }), null);
});

test("a home value can be typed the way people type it", () => {
  assert.equal(parseMoney("$250,000"), 250_000);
  assert.equal(parseMoney("250k"), 250_000);
  assert.equal(parseMoney(" 1.2m "), 1_200_000);
  assert.equal(parseMoney("about 100"), null);
  assert.equal(parseMoney(""), null);
});

test("the notes under the result are the agreed wording", () => {
  assert.equal(LEVY_METHOD_NOTE.auditor, "Estimate based on the county auditor's figure.");
  assert.match(LEVY_METHOD_NOTE.formula, /^Estimate based on Ohio's standard formula \(35% of market value\)\./);
  assert.match(RENEWAL_NOTE, /^A renewal continues an existing tax\./);
});

test("syllables are counted closely enough", () => {
  assert.equal(countSyllables("tax"), 1);
  assert.equal(countSyllables("levy"), 2);
  assert.equal(countSyllables("table"), 2);
  assert.equal(countSyllables("district"), 2);
  assert.equal(countSyllables("education"), 4);
});

test("plain sentences score low and dense ones score high", () => {
  const plain = readingGrade("The school wants to keep a tax. It pays for roofs. A yes vote keeps it.");
  const dense = readingGrade(
    "The aforementioned supplementary appropriation constitutes an extraordinary authorization, notwithstanding prior obligations, contingent upon comprehensive administrative determinations.",
  );
  assert.ok(plain !== null && plain < 4, `plain scored ${plain}`);
  assert.ok(dense !== null && dense > 12, `dense scored ${dense}`);
  assert.equal(readingGrade(""), null);
});

test("templates route to their own address", () => {
  assert.equal(explainerPath("levy", "sample"), "/levy/sample");
  assert.equal(isTemplate("ballot"), true);
  assert.equal(isTemplate("report"), false);
});

test("site copy carries no em dash", () => {
  for (const text of [EXPLAINER_NEUTRALITY, RENEWAL_NOTE, ...Object.values(LEVY_METHOD_NOTE)]) {
    assert.ok(!text.includes("\u2014"), text);
  }
});
