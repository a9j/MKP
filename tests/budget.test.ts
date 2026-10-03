/**
 * The City Budget Explorer's query layer, against the local stack.
 *
 * The development seed loads no city budget on purpose: the adopted budget
 * book is entered by an administrator, and the site has to work on the day
 * before that happens. The end to end suite covers the empty page and then
 * loads a file through the admin screen, so this file asserts what has to hold
 * either way rather than assuming which of the two it is looking at.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCityBudget } from "../src/lib/queries/budget";
import { getExplorerData } from "../src/lib/queries/explorer";

test("an empty city budget is an empty answer, not an exception", async () => {
  const budget = await getCityBudget();
  assert.ok(Array.isArray(budget.funds));
  assert.ok(Array.isArray(budget.fiscalYears));
  assert.ok(Array.isArray(budget.fundYears));
  assert.equal(budget.fundYears.length === 0, budget.funds.length === 0);
});

test("every department carries a source and the shares add up", async () => {
  const budget = await getCityBudget();
  for (const fundYear of budget.fundYears) {
    assert.ok(fundYear.departments.length > 0, `${fundYear.fund} had no departments`);

    for (const department of fundYear.departments) {
      assert.ok(
        department.sourceUrl.trim().length > 0,
        `${department.department} had no source`,
      );
      assert.ok(department.amount > 0);
    }

    // Largest first, so the panel reads top down without re-sorting.
    const amounts = fundYear.departments.map((d) => d.amount);
    assert.deepEqual(amounts, [...amounts].sort((a, b) => b - a));

    const shares = fundYear.departments.reduce((sum, d) => sum + d.share, 0);
    assert.ok(Math.abs(shares - 1) < 1e-9, `shares summed to ${shares}`);

    const total = fundYear.departments.reduce((sum, d) => sum + d.amount, 0);
    assert.ok(Math.abs(total - fundYear.total) < 1e-6);
  }
});

test("the salary Explorer returns data rather than throwing", async () => {
  // The counterpart rule: with a schedule loaded it answers, and with none it
  // returns null. Both have to be true for the build to survive either state.
  const data = await getExplorerData();
  assert.ok(data, "the seed loads a schedule, so this should not be null");
  assert.equal(typeof data.schoolYear, "string");
});
