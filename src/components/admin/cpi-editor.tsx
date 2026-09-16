"use client";

import { useState } from "react";
import { Toast, type ToastTone } from "@/components/admin/toast";
import { saveCpiRow } from "@/app/admin/explorer/actions";

type Row = { year: number; index_value: number; source_url: string };

export function CpiEditor({ rows }: { rows: Row[] }) {
  const [year, setYear] = useState("");
  const [index, setIndex] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await saveCpiRow({
        year: Number(year),
        index_value: Number(index),
        source_url: source,
      });
      setToast({ message: result.message, tone: result.ok ? "ok" : "error" });
      if (result.ok) {
        setYear("");
        setIndex("");
        setSource("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="uploader">
      <h3>CPI</h3>
      <p className="admin-help">
        Used to carry an older schedule forward into today&rsquo;s dollars. Saving a year
        that already exists replaces it.
      </p>

      <form className="admin-form" onSubmit={onSave}>
        <div className="field">
          <label htmlFor="cpi-year">Year</label>
          <input
            id="cpi-year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="cpi-index">Index value</label>
          <input
            id="cpi-index"
            inputMode="decimal"
            value={index}
            onChange={(e) => setIndex(e.target.value)}
            required
          />
        </div>
        <div className="field field-wide">
          <label htmlFor="cpi-source">Source link</label>
          <input
            id="cpi-source"
            type="url"
            placeholder="https://"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            required
          />
        </div>
        <div className="admin-actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Saving" : "Save year"}
          </button>
        </div>
      </form>

      <table className="data-table">
        <caption>{rows.length} year(s) stored.</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Index</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <th scope="row">{row.year}</th>
              <td>{row.index_value}</td>
              <td>
                <a href={row.source_url} target="_blank" rel="noopener noreferrer">
                  Document
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Toast
        message={toast?.message ?? null}
        tone={toast?.tone ?? "ok"}
        onDismiss={() => setToast(null)}
      />
    </section>
  );
}
