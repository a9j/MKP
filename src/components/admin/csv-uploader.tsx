"use client";

import { useRef, useState } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { previewUpload, commitUpload, type PreviewResult } from "@/lib/actions/explorer";
import type { DatasetKey } from "@/lib/explorer-import";

type Props = {
  dataset: DatasetKey;
  label: string;
  columns: string[];
  help: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

export function CsvUploader({ dataset, label, columns, help }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileName(null);
    setText(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setToast({ message: `${file.name} is larger than 5MB.`, tone: "error" });
      reset();
      return;
    }

    setBusy(true);
    setToast(null);
    try {
      const contents = await file.text();
      setFileName(file.name);
      setText(contents);
      setResult(await previewUpload(dataset, contents));
    } catch (error) {
      setToast({ message: `Could not read the file: ${String(error)}`, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!text) return;
    setBusy(true);
    try {
      const commit = await commitUpload(dataset, text);
      setToast({ message: commit.message, tone: commit.ok ? "ok" : "error" });
      if (commit.ok) reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uploader">
      <h3>{label}</h3>
      <p className="admin-help">{help}</p>
      <p className="admin-help">
        Columns: <code>{columns.join(", ")}</code>
      </p>

      <label className="file-field">
        <span className="file-label">Choose a CSV file</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          disabled={busy}
        />
      </label>
      {fileName ? <p className="admin-help">Reading {fileName}</p> : null}

      {result ? (
        <div className="preview">
          <p className={result.ok ? "preview-ok" : "preview-bad"}>{result.message}</p>

          {result.problems.length > 0 ? (
            <table className="data-table">
              <caption>
                Nothing is imported until every problem is fixed. Line numbers match the
                spreadsheet, counting the header as line 1.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Column</th>
                  <th scope="col">Problem</th>
                </tr>
              </thead>
              <tbody>
                {result.problems.slice(0, 50).map((problem, i) => (
                  <tr key={`${problem.line}-${problem.column}-${i}`}>
                    <th scope="row">{problem.line}</th>
                    <td>{problem.column ?? "the file"}</td>
                    <td>{problem.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {result.ok && result.diff ? (
            <>
              <dl className="diff">
                <div>
                  <dt>Rows added</dt>
                  <dd>{result.diff.added}</dd>
                </div>
                <div>
                  <dt>Rows changed</dt>
                  <dd>{result.diff.changed}</dd>
                </div>
                <div>
                  <dt>Unchanged</dt>
                  <dd>{result.diff.unchanged}</dd>
                </div>
                <div>
                  <dt>Left alone</dt>
                  <dd>{result.diff.untouched}</dd>
                </div>
              </dl>

              {result.changedExamples.length > 0 ? (
                <table className="data-table">
                  <caption>What changes, first {result.changedExamples.length}.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      <th scope="col">Column</th>
                      <th scope="col">From</th>
                      <th scope="col">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changedExamples.map((change, i) => (
                      <tr key={i}>
                        <th scope="row">{change.identity}</th>
                        <td>{change.column}</td>
                        <td>{change.from}</td>
                        <td>{change.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}

              <table className="data-table">
                <caption>
                  Preview, {result.preview.length} of {result.totalRows} rows.
                </caption>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th scope="col" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, i) => (
                    <tr key={i}>
                      {columns.map((column) => (
                        <td key={column}>{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="admin-actions">
                <button type="button" className="btn" onClick={onCommit} disabled={busy}>
                  {busy ? "Working" : `Commit ${result.totalRows} rows`}
                </button>
                <button type="button" className="btn ghost" onClick={reset} disabled={busy}>
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </section>
  );
}
