import Markdown from "react-markdown";
import type { Report } from "@/lib/report-types";

/**
 * The fixed shape of a ballot explainer.
 *
 * Three questions, always these three, always in this order. A reader who has
 * read one explainer knows where to look in the next, and a question cannot be
 * quietly dropped because it was the awkward one to answer. The fourth is
 * optional and appears only when the auditor's certification is out.
 *
 * None of these headings is a judgment about the issue. "What happens if it
 * fails" is what the record says follows, not a warning.
 */
const SECTIONS = [
  { key: "asksFor", heading: "What it asks for" },
  { key: "funds", heading: "What it would fund" },
  { key: "ifFails", heading: "What happens if it fails" },
  { key: "homeownerCost", heading: "What it costs a homeowner" },
] as const;

export function ExplainerSections({ report }: { report: Report }) {
  const filled = SECTIONS.filter((section) => (report[section.key] ?? "").trim().length > 0);
  if (filled.length === 0) return null;

  return (
    <div className="explainer">
      {report.issueNumber || report.ballotDateLabel ? (
        <p className="explainer-ballot">
          {report.issueNumber}
          {report.issueNumber && report.ballotDateLabel ? ", " : ""}
          {report.ballotDateLabel ? `on the ballot ${report.ballotDateLabel}` : ""}
        </p>
      ) : null}

      {filled.map((section) => (
        <section className="explainer-section" key={section.key}>
          <h2>{section.heading}</h2>
          <Markdown>{report[section.key] ?? ""}</Markdown>
        </section>
      ))}

      <p className="note">
        What the record says, in the same three parts for every issue. We do not take
        positions, endorse candidates, or recommend how to vote.
      </p>
    </div>
  );
}
