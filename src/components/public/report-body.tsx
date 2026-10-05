import Markdown from "react-markdown";
import { Sourced } from "@/components/sourced";
import { PrintButton } from "@/components/public/print-button";
import type { Report } from "@/lib/report-types";

/**
 * The parts of a report page that the public view and the council preview
 * share, so a reviewer reads exactly what a reader will.
 *
 * The full explainer reads on the page. The PDF is an optional download:
 * the attached file when there is one, otherwise a print-to-PDF of this page.
 * A report with no body text falls back to showing the PDF inline.
 *
 * react-markdown renders on the server and disallows raw HTML, so neither the
 * summary nor the body can smuggle markup onto the page.
 */
export function ReportBody({ report }: { report: Report }) {
  const hasBody = report.body.trim().length > 0;

  return (
    <>
      <div className="report-meta">
        <span>{report.reportDateLabel}</span>
        <span>{report.typeLabel}</span>
      </div>

      <div className="report-summary">
        <Markdown>{report.summary}</Markdown>
      </div>

      <div className="actions no-print">
        {report.pdfUrl ? (
          <a className="btn" href={report.pdfUrl} download>
            Download the PDF
          </a>
        ) : hasBody ? (
          <PrintButton />
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

      {hasBody ? (
        <article className="report-summary report-full">
          <Markdown
            components={{
              a: ({ href, children }) =>
                href?.startsWith("/") ? (
                  <a href={href}>{children}</a>
                ) : (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
            }}
          >
            {report.body}
          </Markdown>
        </article>
      ) : report.pdfUrl ? (
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
