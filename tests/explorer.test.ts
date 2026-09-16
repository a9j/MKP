/**
 * Explorer logic against the local stack. Covers the rules the brief is strict
 * about: every figure is sourced, a district with different lane names is not
 * guessed at, and a missing 2010 basis hides the inflation line.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getExplorerData,
  getBudgetCategories,
  getVacancies,
} from "../src/lib/queries/explorer";

test("reads the latest school year and the home district", async () => {
  const data = await getExplorerData();
  assert.equal(data.schoolYear, "2026-2027");
  assert.equal(data.homeDistrict, "Toledo Public Schools");
  assert.ok(!data.districts.includes(data.homeDistrict), "home district listed as a comparison");
});

test("lanes and steps come from the home district", async () => {
  const data = await getExplorerData();
  assert.deepEqual(data.lanes, ["BA", "BA+15", "MA", "MA+30"]);
  assert.deepEqual(data.steps, [1, 3, 7, 10, 15, 20]);
});

test("every salary figure carries a source url", async () => {
  const data = await getExplorerData();
  let checked = 0;
  for (const table of Object.values(data.byDistrict)) {
    for (const lane of Object.values(table)) {
      for (const cell of Object.values(lane)) {
        assert.ok(cell.sourceUrl.trim().length > 0, "a salary cell had no source");
        assert.ok(cell.value > 0, "a salary cell had no value");
        checked++;
      }
    }
  }
  assert.ok(checked >= 100, `expected the seed to provide many cells, got ${checked}`);
});

test("a district with different lane names is not comparable", async () => {
  const data = await getExplorerData();
  assert.ok(data.districts.includes("Springfield"));
  const springfield = data.byDistrict.Springfield;
  // Springfield publishes Bachelors and Masters, so asking for BA must miss
  // rather than fall through to something that looks close.
  assert.equal(springfield.BA, undefined);
  assert.ok(springfield.Bachelors, "expected Springfield to use its own lane names");
});

test("a comparable district answers on the same lane and step", async () => {
  const data = await getExplorerData();
  const cell = data.byDistrict.Sylvania?.["BA+15"]?.[7];
  assert.ok(cell, "expected Sylvania to share the home lane names");
  assert.ok(cell.value > 0);
  assert.ok(cell.sourceUrl.startsWith("https://"));
});

test("scenarios come from site settings", async () => {
  const data = await getExplorerData();
  assert.equal(data.scenarioAPct, 3);
  assert.equal(data.scenarioBFlat, 2000);
});

test("the inflation basis uses 2010 and the newest CPI", async () => {
  const data = await getExplorerData();
  assert.ok(data.inflation, "expected an inflation basis from the seed");
  const inflation = data.inflation!;
  assert.equal(inflation.baseSchoolYear, "2010-2011");
  assert.equal(inflation.baseCpiYear, 2010);
  assert.equal(inflation.latestCpiYear, 2026);
  // 331.402 / 218.056
  assert.ok(Math.abs(inflation.factor - 1.51981) < 0.001, `factor was ${inflation.factor}`);
  assert.ok(inflation.cpiSourceUrl.length > 0);
  assert.ok(inflation.salaries["BA+15"][7].value > 0);
});

test("budget categories carry sources and shares that add up", async () => {
  const { fiscalYear, categories, total } = await getBudgetCategories();
  assert.equal(fiscalYear, "2026");
  assert.ok(categories.length > 0);
  for (const c of categories) assert.ok(c.sourceUrl.length > 0, `${c.category} had no source`);
  const sum = categories.reduce((s, c) => s + c.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `shares summed to ${sum}`);
  assert.equal(total, categories.reduce((s, c) => s + c.amount, 0));
  // Sorted largest first.
  assert.equal(categories[0].category, "Instruction");
});

test("vacancies compute days open against the as of date", async () => {
  const { asOf, vacancies } = await getVacancies();
  assert.equal(asOf, "2026-09-01");
  assert.ok(vacancies.length > 0);
  for (const v of vacancies) assert.ok(v.sourceUrl.length > 0);

  // Open postings first, longest open at the top.
  assert.ok(vacancies[0].open);
  const psych = vacancies.find((v) => v.position === "School Psychologist")!;
  assert.equal(psych.open, true);
  assert.equal(psych.daysOpen, 104); // 2026-05-20 to 2026-09-01

  const math = vacancies.find((v) => v.position === "Math Teacher")!;
  assert.equal(math.open, false);
  assert.equal(math.daysOpen, 49); // 2026-06-30 to 2026-08-18
});
