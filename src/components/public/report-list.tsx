"use client";

import { useState } from "react";
import Link from "next/link";
import { REPORT_FILTERS, type Report } from "@/lib/report-types";

export function ReportList({ reports }: { reports: Report[] }) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? reports : reports.filter((r) => r.type === filter);

  return (
    <>
      <div className="filters" role="group" aria-label="Filter reports by type">
        {REPORT_FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            className="filter"
            aria-pressed={filter === option.key}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="admin-help" aria-live="polite">
        {shown.length} of {reports.length} reports shown.
      </p>

      {shown.length === 0 ? (
        <p className="sub">No reports of this type yet.</p>
      ) : (
        <div className="report-log">
          {shown.map((report) => (
            <article className="report-row" key={report.id}>
              <div className="report-row-head">
                <span className="vote-date">{report.reportDateLabel}</span>
                <span className="vote-kind">{report.typeLabel}</span>
              </div>
              <h3>
                <Link href={`/reports/${report.slug}`}>{report.title}</Link>
              </h3>

              <p className="report-actions">
                {report.pdfUrl ? (
                  <a href={report.pdfUrl} download>
                    Download PDF
                  </a>
                ) : (
                  <span className="unavailable">No PDF yet</span>
                )}
                <Link href={`/reports/${report.slug}`}>Read the report</Link>
              </p>

              <details>
                <summary>View sources</summary>
                <ol className="sources-list">
                  {report.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
