import type { Metadata } from "next";
import { ReportList } from "@/components/public/report-list";
import { getPublishedReports } from "@/lib/queries/reports";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Reports",
  description:
    "The annual Toledo Teacher Pay Report, levy explainers, and contract trackers. Reviewed, sourced, free.",
};

export default async function ReportsPage() {
  const [reports, settings] = await Promise.all([getPublishedReports(), getSiteSettings()]);

  const latestPayReport = reports.find((r) => r.type === "pay_report");

  /** Report types, verbatim from the copy doc. */
  const TYPES = [
    {
      title: "The Toledo Teacher Pay Report",
      cadence: "Every fall.",
      body: "What TPS teachers earn at each step, how that compares to nearby districts and to inflation, what the district's finances actually look like, and three sourced raise scenarios with what each would cost.",
      status: latestPayReport
        ? { label: `Read the ${latestPayReport.reportDate.slice(0, 4)} report`, href: `/reports/${latestPayReport.slug}` }
        : { label: settings.reports_next_report_note ?? "[Coming November 2026]", href: null },
    },
    {
      title: "Levy Explainers",
      cadence: "When a levy is on the ballot.",
      body: "What it asks for, what it funds, what happens if it fails. No recommendation.",
      status: { label: settings.levy_status_note ?? "[No levy currently on the ballot.]", href: null },
    },
    {
      title: "Contract Tracker",
      cadence: "When contract talks open.",
      body: "The current agreement side by side with the surrounding districts on pay, planning time, class size, and health contributions.",
      status: { label: settings.contract_status_note ?? "[Talks are not currently open.]", href: null },
    },
  ];

  return (
    <>
      <header className="wrap page-head">
        <h1>We publish when the numbers matter.</h1>
        <p className="lede">
          Not on a schedule nobody notices. Each report is reviewed by our advisory
          council before release and offered as a briefing to the union, the board,
          and the press.
        </p>
      </header>

      <section className="wrap vote-section">
        <div className="features">
          {TYPES.map((type) => (
            <div className="feature" key={type.title}>
              <div className="tag">{type.cadence}</div>
              <h3>{type.title}</h3>
              <p>{type.body}</p>
              <p className="report-actions">
                {type.status.href ? (
                  <a href={type.status.href}>{type.status.label}</a>
                ) : (
                  <span className="unavailable">{type.status.label}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>All reports</h2>
          <ReportList reports={reports} />
        </div>
      </section>

      <section className="wrap vote-section">
        <p className="note">
          Every report is free to read and share. If you would like a briefing for your
          organization, write to{" "}
          <a href="mailto:hello@monakproject.org">hello@monakproject.org</a>.
        </p>
      </section>
    </>
  );
}
