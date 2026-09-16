/**
 * A small CSV reader.
 *
 * Handles quoted fields, embedded commas and newlines, doubled quotes, CRLF,
 * and a UTF-8 byte order mark, which is what a spreadsheet export actually
 * produces. Anything more exotic than that is better rejected with a clear
 * message than guessed at.
 */

export type CsvTable = {
  header: string[];
  /** One entry per data row, already aligned to the header. */
  rows: string[][];
};

export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // A trailing newline should not produce a row of one empty string.
    if (!(row.length === 1 && row[0].trim() === "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      endField();
      i++;
      continue;
    }
    if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
      i++;
      continue;
    }
    if (char === "\n") {
      endRow();
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) endRow();

  const header = (rows.shift() ?? []).map((h) => h.trim());
  return { header, rows };
}
