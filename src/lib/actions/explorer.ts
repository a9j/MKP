"use server";

import { requireAdminUser, NotAnAdminError } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { revalidateFor } from "@/lib/revalidate";
import {
  DATASETS,
  type DatasetKey,
  type ImportRow,
  type RowProblem,
  type Diff,
  validateCsv,
  diffAgainstExisting,
  summarizeDiff,
} from "@/lib/explorer-import";

export type PreviewResult = {
  ok: boolean;
  message: string;
  problems: RowProblem[];
  /** First rows only. The whole file is re-read on commit. */
  preview: ImportRow[];
  totalRows: number;
  diff: { added: number; changed: number; unchanged: number; untouched: number } | null;
  diffSummary: string | null;
  changedExamples: { identity: string; column: string; from: string; to: string }[];
};

const PREVIEW_ROWS = 25;
const CHANGE_EXAMPLES = 10;

function emptyPreview(message: string, problems: RowProblem[] = []): PreviewResult {
  return {
    ok: false,
    message,
    problems,
    preview: [],
    totalRows: 0,
    diff: null,
    diffSummary: null,
    changedExamples: [],
  };
}

async function readExisting(key: DatasetKey): Promise<ImportRow[]> {
  const spec = DATASETS[key];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from(spec.table)
    .select(spec.columns.map((c) => c.name).join(", "));
  if (error) throw new Error(`Could not read the current ${spec.label.toLowerCase()}: ${error.message}`);
  return (data ?? []) as unknown as ImportRow[];
}

/** Validates an upload and describes what committing it would change. */
export async function previewUpload(key: DatasetKey, text: string): Promise<PreviewResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return emptyPreview(error.message);
    throw error;
  }

  const spec = DATASETS[key];
  const { rows, problems } = validateCsv(spec, text);

  if (problems.length > 0) {
    // Nothing is imported from a file with a problem in it. A half imported
    // schedule is worse than a rejected one.
    return emptyPreview(
      `${problems.length} problem${problems.length === 1 ? "" : "s"} found. Nothing was imported.`,
      problems,
    );
  }

  const diff = diffAgainstExisting(spec, rows, await readExisting(key));

  return {
    ok: true,
    message: `${rows.length} row${rows.length === 1 ? "" : "s"} read. ${summarizeDiff(diff)}.`,
    problems: [],
    preview: rows.slice(0, PREVIEW_ROWS),
    totalRows: rows.length,
    diff: {
      added: diff.added.length,
      changed: diff.changed.length,
      unchanged: diff.unchanged,
      untouched: diff.untouched,
    },
    diffSummary: summarizeDiff(diff),
    changedExamples: describeChanges(spec.identity, diff),
  };
}

function describeChanges(identity: string[], diff: Diff) {
  return diff.changed.slice(0, CHANGE_EXAMPLES).map(({ row, changes }) => ({
    identity: identity.map((name) => String(row[name] ?? "")).join(", "),
    column: changes[0].column,
    from: String(changes[0].from ?? ""),
    to: String(changes[0].to ?? ""),
  }));
}

export type CommitResult = { ok: boolean; message: string; problems: RowProblem[] };

/**
 * Writes the upload. Re-validates rather than trusting the preview, since the
 * preview and the commit are separate requests.
 */
export async function commitUpload(key: DatasetKey, text: string): Promise<CommitResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return { ok: false, message: error.message, problems: [] };
    throw error;
  }

  const spec = DATASETS[key];
  const { rows, problems } = validateCsv(spec, text);
  if (problems.length > 0) {
    return {
      ok: false,
      message: `${problems.length} problem${problems.length === 1 ? "" : "s"} found. Nothing was imported.`,
      problems,
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from(spec.table)
    .upsert(rows as never, { onConflict: spec.identity.join(",") });

  if (error) {
    return { ok: false, message: `Nothing was imported: ${error.message}`, problems: [] };
  }

  revalidateFor("explorerData");
  return {
    ok: true,
    message: `${spec.label} updated, ${rows.length} row${rows.length === 1 ? "" : "s"}.`,
    problems: [],
  };
}

export type CpiRow = { year: number; index_value: number; source_url: string };

export async function saveCpiRow(row: CpiRow): Promise<CommitResult> {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof NotAnAdminError) return { ok: false, message: error.message, problems: [] };
    throw error;
  }

  if (!Number.isInteger(row.year) || row.year < 1900 || row.year > 2200) {
    return { ok: false, message: `"${row.year}" is not a year.`, problems: [] };
  }
  if (!Number.isFinite(row.index_value) || row.index_value <= 0) {
    return { ok: false, message: "The index value must be a positive number.", problems: [] };
  }
  if (!/^https?:\/\/\S+$/i.test(row.source_url.trim())) {
    return {
      ok: false,
      message: "A source link is required, starting with http:// or https://.",
      problems: [],
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("cpi")
    .upsert({ ...row, source_url: row.source_url.trim() }, { onConflict: "year" });

  if (error) return { ok: false, message: `Not saved: ${error.message}`, problems: [] };

  revalidateFor("explorerData");
  return { ok: true, message: `CPI for ${row.year} saved.`, problems: [] };
}
