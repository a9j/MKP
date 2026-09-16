import Markdown from "react-markdown";
import { Sourced } from "@/components/sourced";
import type { Report } from "@/lib/report-types";

/**
 * The parts of a report page that the public view and the council preview
 * share, so a reviewer reads exactly what a reader will.
 *
 * react-markdown renders on the server and disallows raw HTML, so a summary
 * cannot smuggle markup onto the page, and no parser reaches the browser.
 */
export function ReportBody({ report }: { report: Report }) {
  return (
    <>
      <div className="report-meta">
        <span>{report.reportDateLabel}</span>
        <span>{report.typeLabel}</span>
      </div>

      <div className="report-summary">
        <Markdown>{report.summary}</Markdown>
      </div>

      <div className="actions">
        {report.pdfUrl ? (
          <a className="btn" href={report.pdfUrl} download>
            Download the PDF
          </a>
        ) : (
          <span className="unavailable">No PDF attached yet.</span>
        )}
        <a
          className="btn ghost"
          href={`mailto:hello@monakproject.org?subject=${encodeURIComponent(`Briefing request: ${report.title}`)}`}
        >
          Request a briefing
        </a>
      </div>

      {report.pdfUrl ? (
        <object className="pdf-embed" data={report.pdfUrl} type="application/pdf">
          <p className="admin-help">
            Your browser cannot show the PDF here.{" "}
            <a href={report.pdfUrl} download>
              Download it instead
            </a>
            .
          </p>
        </object>
      ) : null}

      <h2 className="sources-head">Sources</h2>
      <p className="sub">Every figure in this report comes from one of these documents.</p>
      <ol className="sources-list">
        {report.sources.map((source) => (
          <li key={source.url}>
            <Sourced href={source.url}>{source.label}</Sourced>
          </li>
        ))}
      </ol>
    </>
  );
}
