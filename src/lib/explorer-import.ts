import { parseCsv } from "@/lib/csv";

/**
 * Validation and diffing for the three Explorer CSV uploads.
 *
 * Kept free of any database or request handling so the rules can be tested
 * directly. The rule that matters most: a row without a source_url is never
 * imported, because a figure the site cannot link to a document is a figure
 * the site will not publish.
 */

export type DatasetKey = "salary_schedule" | "vacancies" | "budget_categories";

type ColumnKind = "text" | "integer" | "money" | "date" | "url";

type ColumnSpec = {
  name: string;
  kind: ColumnKind;
  optional?: boolean;
};

export type DatasetSpec = {
  key: DatasetKey;
  table: DatasetKey;
  label: string;
  columns: ColumnSpec[];
  /** Columns that identify a row, used for the diff and for upserting. */
  identity: string[];
};

export const DATASETS: Record<DatasetKey, DatasetSpec> = {
  salary_schedule: {
    key: "salary_schedule",
    table: "salary_schedule",
    label: "Salary schedule",
    columns: [
      { name: "school_year", kind: "text" },
      { name: "district", kind: "text" },
      { name: "lane", kind: "text" },
      { name: "step", kind: "integer" },
      { name: "salary", kind: "money" },
      { name: "source_url", kind: "url" },
    ],
    identity: ["school_year", "district", "lane", "step"],
  },
  vacancies: {
    key: "vacancies",
    table: "vacancies",
    label: "Vacancies",
    columns: [
      { name: "as_of_date", kind: "date" },
      { name: "position", kind: "text" },
      { name: "building", kind: "text", optional: true },
      { name: "posted_date", kind: "date", optional: true },
      { name: "filled_date", kind: "date", optional: true },
      { name: "source_url", kind: "url" },
    ],
    identity: ["as_of_date", "position", "building", "posted_date"],
  },
  budget_categories: {
    key: "budget_categories",
    table: "budget_categories",
    label: "Budget categories",
    columns: [
      { name: "fiscal_year", kind: "text" },
      { name: "category", kind: "text" },
      { name: "amount", kind: "money" },
      { name: "source_url", kind: "url" },
    ],
    identity: ["fiscal_year", "category"],
  },
};

export type CellValue = string | number | null;
export type ImportRow = Record<string, CellValue>;

export type RowProblem = {
  /** 1 based, counting the header as line 1, so it matches the spreadsheet. */
  line: number;
  column: string | null;
  message: string;
};

export type ValidationResult = {
  rows: ImportRow[];
  problems: RowProblem[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(raw: string): string | null {
  if (!ISO_DATE.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-31, which Date would roll forward into March.
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return raw;
}

function parseMoney(raw: string): number | null {
  // Accepts what a spreadsheet exports: $52,410 or 52410.00
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (cleaned.length === 0) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function validateCsv(spec: DatasetSpec, text: string): ValidationResult {
  const { header, rows } = parseCsv(text);
  const problems: RowProblem[] = [];

  if (header.length === 0) {
    return { rows: [], problems: [{ line: 1, column: null, message: "The file is empty." }] };
  }

  const expected = spec.columns.map((c) => c.name);
  const missing = expected.filter((name) => !header.includes(name));
  const unknown = header.filter((name) => !expected.includes(name));

  if (missing.length > 0) {
    problems.push({
      line: 1,
      column: null,
      message: `Missing column(s): ${missing.join(", ")}. Expected: ${expected.join(", ")}.`,
    });
  }
  if (unknown.length > 0) {
    problems.push({
      line: 1,
      column: null,
      message: `Unexpected column(s): ${unknown.join(", ")}. Expected: ${expected.join(", ")}.`,
    });
  }
  if (problems.length > 0) return { rows: [], problems };

  const index = new Map(header.map((name, i) => [name, i]));
  const parsed: ImportRow[] = [];
  const seen = new Map<string, number>();

  rows.forEach((cells, i) => {
    const line = i + 2;
    const row: ImportRow = {};
    let rowOk = true;

    for (const column of spec.columns) {
      const raw = (cells[index.get(column.name)!] ?? "").trim();

      if (raw.length === 0) {
        if (column.kind === "url") {
          // Called out separately because it is the rule that keeps an
          // unsourced figure off the site.
          problems.push({
            line,
            column: column.name,
            message: "No source_url. Every row must link to the document it came from.",
          });
          rowOk = false;
          continue;
        }
        if (!column.optional) {
          problems.push({ line, column: column.name, message: `${column.name} is required.` });
          rowOk = false;
          continue;
        }
        row[column.name] = null;
        continue;
      }

      switch (column.kind) {
        case "integer": {
          const value = Number(raw);
          if (!Number.isInteger(value)) {
            problems.push({ line, column: column.name, message: `"${raw}" is not a whole number.` });
            rowOk = false;
          } else {
            row[column.name] = value;
          }
          break;
        }
        case "money": {
          const value = parseMoney(raw);
          if (value === null) {
            problems.push({ line, column: column.name, message: `"${raw}" is not an amount.` });
            rowOk = false;
          } else if (value < 0) {
            problems.push({ line, column: column.name, message: `"${raw}" is negative.` });
            rowOk = false;
          } else {
            row[column.name] = value;
          }
          break;
        }
        case "date": {
          const value = parseDate(raw);
          if (value === null) {
            problems.push({
              line,
              column: column.name,
              message: `"${raw}" is not a date. Use YYYY-MM-DD.`,
            });
            rowOk = false;
          } else {
            row[column.name] = value;
          }
          break;
        }
        case "url": {
          if (!/^https?:\/\/\S+$/i.test(raw)) {
            problems.push({
              line,
              column: column.name,
              message: `"${raw}" is not a link. A source must start with http:// or https://.`,
            });
            rowOk = false;
          } else {
            row[column.name] = raw;
          }
          break;
        }
        default:
          row[column.name] = raw;
      }
    }

    if (!rowOk) return;

    const fingerprint = identityOf(spec, row);
    const first = seen.get(fingerprint);
    if (first !== undefined) {
      problems.push({
        line,
        column: null,
        message: `Same ${spec.identity.join(", ")} as line ${first}. Remove the duplicate.`,
      });
      return;
    }
    seen.set(fingerprint, line);
    parsed.push(row);
  });

  if (parsed.length === 0 && problems.length === 0) {
    problems.push({ line: 1, column: null, message: "The file has a header but no rows." });
  }

  return { rows: parsed, problems };
}

export function identityOf(spec: DatasetSpec, row: ImportRow): string {
  return spec.identity.map((name) => String(row[name] ?? "")).join("␟");
}

export type RowChange = {
  column: string;
  from: CellValue;
  to: CellValue;
};

export type Diff = {
  added: ImportRow[];
  changed: { row: ImportRow; changes: RowChange[] }[];
  unchanged: number;
  /** Rows already stored that the file does not mention. Never deleted. */
  untouched: number;
};

function sameValue(a: CellValue, b: CellValue): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a) === String(b);
}

/**
 * Compares an upload against what is already stored.
 *
 * An upload adds and updates, it never deletes: a partial file should not wipe
 * rows the uploader did not mean to touch. Rows the file does not mention are
 * counted so the number is visible before committing.
 */
export function diffAgainstExisting(
  spec: DatasetSpec,
  incoming: ImportRow[],
  existing: ImportRow[],
): Diff {
  const byIdentity = new Map(existing.map((row) => [identityOf(spec, row), row]));
  const diff: Diff = { added: [], changed: [], unchanged: 0, untouched: 0 };
  const touched = new Set<string>();

  for (const row of incoming) {
    const fingerprint = identityOf(spec, row);
    const current = byIdentity.get(fingerprint);
    if (!current) {
      diff.added.push(row);
      continue;
    }
    touched.add(fingerprint);

    const changes: RowChange[] = [];
    for (const column of spec.columns) {
      if (spec.identity.includes(column.name)) continue;
      if (!sameValue(current[column.name] ?? null, row[column.name] ?? null)) {
        changes.push({
          column: column.name,
          from: current[column.name] ?? null,
          to: row[column.name] ?? null,
        });
      }
    }
    if (changes.length > 0) diff.changed.push({ row, changes });
    else diff.unchanged++;
  }

  // touched already holds every matched row, changed ones included, so
  // subtracting the changed count again would double count them.
  diff.untouched = existing.length - touched.size;
  return diff;
}

export function summarizeDiff(diff: Diff): string {
  const parts = [
    `${diff.added.length} row${diff.added.length === 1 ? "" : "s"} added`,
    `${diff.changed.length} changed`,
    `${diff.unchanged} unchanged`,
  ];
  if (diff.untouched > 0) parts.push(`${diff.untouched} left alone`);
  return parts.join(", ");
}
