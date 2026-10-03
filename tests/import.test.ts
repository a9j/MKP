/**
 * CSV parsing, validation and diffing. Pure logic, no database, so every rule
 * can be pinned down directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/lib/csv";
import {
  DATASETS,
  validateCsv,
  diffAgainstExisting,
  summarizeDiff,
} from "../src/lib/explorer-import";

const salary = DATASETS.salary_schedule;

test("parses quoted fields, embedded commas and CRLF", () => {
  const { header, rows } = parseCsv('a,b\r\n1,"x, y"\r\n2,"he said ""hi"""\r\n');
  assert.deepEqual(header, ["a", "b"]);
  assert.deepEqual(rows, [
    ["1", "x, y"],
    ["2", 'he said "hi"'],
  ]);
});

test("strips a byte order mark and ignores a trailing newline", () => {
  const { header, rows } = parseCsv('﻿a,b\n1,2\n');
  assert.deepEqual(header, ["a", "b"]);
  assert.equal(rows.length, 1);
});

test("keeps a newline inside a quoted field", () => {
  const { rows } = parseCsv('a,b\n1,"line one\nline two"\n');
  assert.equal(rows[0][1], "line one\nline two");
});

test("accepts the sample salary CSV", () => {
  const text = readFileSync("data/samples/salary_schedule.csv", "utf8");
  const { rows, problems } = validateCsv(salary, text);
  assert.deepEqual(problems, []);
  assert.equal(rows.length, 18);
  assert.equal(rows[0].school_year, "2025-2026");
  assert.equal(rows[0].step, 1);
  assert.equal(rows[0].salary, 44000);
});

test("rejects the sample with a missing source_url, naming the line", () => {
  const text = readFileSync("data/samples/salary_schedule_missing_source.csv", "utf8");
  const { rows, problems } = validateCsv(salary, text);
  assert.equal(rows.length, 2, "the two sound rows still parse");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].line, 3);
  assert.equal(problems[0].column, "source_url");
  assert.match(problems[0].message, /source_url/);
  assert.match(problems[0].message, /link to the document/);
});

test("rejects a source that is not a link", () => {
  const text =
    "school_year,district,lane,step,salary,source_url\n" +
    "2025-2026,TPS,BA,1,44000,see the binder\n";
  const { problems } = validateCsv(salary, text);
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /http/);
});

test("reports missing and unexpected columns before looking at rows", () => {
  const { problems } = validateCsv(salary, "school_year,district,lane,step,salary,notes\n");
  assert.equal(problems.length, 2);
  assert.match(problems[0].message, /Missing column\(s\): source_url/);
  assert.match(problems[1].message, /Unexpected column\(s\): notes/);
});

test("rejects a bad number, a bad date and a rolled over date", () => {
  const bad =
    "school_year,district,lane,step,salary,source_url\n" +
    "2025-2026,TPS,BA,one,44000,https://example.com/a.pdf\n";
  assert.match(validateCsv(salary, bad).problems[0].message, /not a whole number/);

  const vac = DATASETS.vacancies;
  const badDate =
    "as_of_date,position,building,posted_date,filled_date,source_url\n" +
    "2026-02-31,Teacher,Main,2026-01-01,,https://example.com/a.pdf\n";
  assert.match(validateCsv(vac, badDate).problems[0].message, /not a date/);
});

test("accepts spreadsheet money formatting", () => {
  const text =
    "school_year,district,lane,step,salary,source_url\n" +
    '2025-2026,TPS,BA,1,"$52,410.00",https://example.com/a.pdf\n';
  const { rows, problems } = validateCsv(salary, text);
  assert.deepEqual(problems, []);
  assert.equal(rows[0].salary, 52410);
});

test("catches a duplicate key inside one file", () => {
  const text =
    "school_year,district,lane,step,salary,source_url\n" +
    "2025-2026,TPS,BA,1,44000,https://example.com/a.pdf\n" +
    "2025-2026,TPS,BA,1,45000,https://example.com/a.pdf\n";
  const { rows, problems } = validateCsv(salary, text);
  assert.equal(rows.length, 1);
  assert.match(problems[0].message, /Same school_year, district, lane, step as line 2/);
});

test("optional columns may be blank but source_url may not", () => {
  const vac = DATASETS.vacancies;
  const text =
    "as_of_date,position,building,posted_date,filled_date,source_url\n" +
    "2026-09-01,Teacher,,,,https://example.com/a.pdf\n";
  const { rows, problems } = validateCsv(vac, text);
  assert.deepEqual(problems, []);
  assert.equal(rows[0].building, null);
  assert.equal(rows[0].filled_date, null);
});

test("a header with no rows is an error, not a silent no op", () => {
  const { problems } = validateCsv(salary, "school_year,district,lane,step,salary,source_url\n");
  assert.match(problems[0].message, /no rows/);
});

test("the diff separates added, changed and unchanged", () => {
  const existing = [
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 1, salary: 44000, source_url: "https://example.com/a.pdf" },
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 3, salary: 46000, source_url: "https://example.com/a.pdf" },
    { school_year: "2025-2026", district: "TPS", lane: "MA", step: 1, salary: 48000, source_url: "https://example.com/a.pdf" },
  ];
  const incoming = [
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 1, salary: 44000, source_url: "https://example.com/a.pdf" },
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 3, salary: 47000, source_url: "https://example.com/a.pdf" },
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 7, salary: 50000, source_url: "https://example.com/a.pdf" },
  ];
  const diff = diffAgainstExisting(salary, incoming, existing);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].step, 7);
  assert.equal(diff.changed.length, 1);
  assert.deepEqual(diff.changed[0].changes, [{ column: "salary", from: 46000, to: 47000 }]);
  assert.equal(diff.unchanged, 1);
  // The MA row is not in the file and is left alone rather than deleted.
  assert.equal(diff.untouched, 1);
  assert.equal(summarizeDiff(diff), "1 row added, 1 changed, 1 unchanged, 1 left alone");
});

test("a numeric string from the database matches a parsed number", () => {
  // Postgres returns numeric as a string over PostgREST, which must not read
  // as a change on every single row.
  const existing = [
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 1, salary: "44000.00", source_url: "https://example.com/a.pdf" },
  ];
  const incoming = [
    { school_year: "2025-2026", district: "TPS", lane: "BA", step: 1, salary: 44000, source_url: "https://example.com/a.pdf" },
  ];
  const diff = diffAgainstExisting(salary, incoming, existing);
  assert.equal(diff.changed.length, 0, "numeric formatting was treated as a change");
  assert.equal(diff.unchanged, 1);
});

// ---------------------------------------------------------------------------
// The city budget, added in phase 2. Same validator, two new shapes.
// ---------------------------------------------------------------------------

const cityBudget = DATASETS.city_budget;
const cityPopulation = DATASETS.city_population;

test("accepts the sample city budget CSV, page number and all", () => {
  const text = readFileSync("data/samples/city_budget.csv", "utf8");
  const { rows, problems } = validateCsv(cityBudget, text);
  assert.deepEqual(problems, []);
  assert.equal(rows.length, 16);
  assert.equal(rows[0].fiscal_year, 2026);
  assert.equal(rows[0].amount, 96000000);
  assert.equal(rows[0].source_page, 118);
});

test("a city budget row with no source link is refused", () => {
  const text = readFileSync("data/samples/city_budget_missing_source.csv", "utf8");
  const { rows, problems } = validateCsv(cityBudget, text);
  // The validator reports the problem and drops the offending row. Refusing
  // the file whole is the caller's rule, and the end to end suite covers it
  // through the screen an administrator actually uses.
  assert.equal(problems.length, 1);
  assert.equal(problems[0].column, "source_url");
  assert.match(problems[0].message, /link to the document/);
  assert.equal(rows.length, 1, "only the sound row survives validation");
  assert.equal(rows[0].department, "Police");
});

test("a page number is optional, but not a page number of zero", () => {
  const header = "fiscal_year,fund,department,category,amount,source_url,source_page\n";
  const url = "https://example.com/budget.pdf";

  const blank = validateCsv(cityBudget, `${header}2026,General Fund,Police,Personnel,10,${url},\n`);
  assert.deepEqual(blank.problems, []);
  assert.equal(blank.rows[0].source_page, null);

  const zero = validateCsv(cityBudget, `${header}2026,General Fund,Police,Personnel,10,${url},0\n`);
  assert.equal(zero.rows.length, 0);
  assert.equal(zero.problems[0].column, "source_page");
});

test("two rows for the same fund, department and category are a duplicate", () => {
  const header = "fiscal_year,fund,department,category,amount,source_url,source_page\n";
  const url = "https://example.com/budget.pdf";
  const { rows, problems } = validateCsv(
    cityBudget,
    `${header}2026,General Fund,Police,Personnel,10,${url},1\n` +
      `2026,General Fund,Police,Personnel,20,${url},2\n`,
  );
  assert.equal(rows.length, 1);
  assert.match(problems[0].message, /Same fiscal_year, fund, department, category/);
});

test("a population has to be a positive whole number", () => {
  const header = "year,population,source_url\n";
  const url = "https://example.com/census.pdf";

  const ok = validateCsv(cityPopulation, `${header}2025,265300,${url}\n`);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.rows[0].population, 265300);

  const negative = validateCsv(cityPopulation, `${header}2025,-5,${url}\n`);
  assert.equal(negative.rows.length, 0);
  assert.equal(negative.problems[0].column, "population");
});
