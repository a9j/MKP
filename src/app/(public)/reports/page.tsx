import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { ReportList } from "@/components/public/report-list";
import { ballotGroups, getPublishedReports } from "@/lib/queries/reports";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Reports",
  description:
    "The annual Toledo Teacher Pay Report, ballot explainers, levy explainers, and contract trackers. Reviewed, sourced, free.",
};

export default async function ReportsPage() {
  const [reports, settings] = await Promise.all([getPublishedReports(), getSiteSettings()]);

  const latestPayReport = reports.find((r) => r.type === "pay_report");
  const latestBallot = reports.find((r) => r.type === "ballot_explainer");

  // Explainers for an election still to come, soonest first and then by issue
  // number. The heading carries the date, so it goes stale by itself rather
  // than needing anyone to take it down.
  const groups = ballotGroups(reports);

  /** Report types, verbatim from the copy doc. */
  const TYPES = [
    {
      tone: "navy",
      title: "The Toledo Teacher Pay Report",
      cadence: "Every fall",
      body: "What TPS teachers earn at each step, how that compares to nearby districts and to inflation, what the district's finances actually look like, and three sourced raise scenarios with what each would cost.",
      status: latestPayReport
        ? { label: `Read the ${latestPayReport.reportDate.slice(0, 4)} report`, href: `/reports/${latestPayReport.slug}` }
        : { label: settings.reports_next_report_note ?? "Coming November 2026", href: null },
    },
    {
      tone: "teal",
      title: "Ballot Explainers",
      cadence: "Every election",
      body: "What each ballot issue asks for, what it funds, what it costs, and what happens if it passes or fails. No recommendation, no endorsement.",
      status: latestBallot
        ? { label: `Read the latest explainer`, href: `/reports/${latestBallot.slug}` }
        : { label: "Explainers for the November 3 election are on the way", href: null },
    },
    {
      tone: "gold",
      title: "Levy Explainers",
      cadence: "When a levy is on the ballot",
      body: "What it asks for, what it funds, what happens if it fails. No recommendation.",
      status: { label: settings.levy_status_note ?? "No levy currently on the ballot", href: null },
    },
    {
      tone: "navy",
      title: "Contract Tracker",
      cadence: "When contract talks open",
      body: "The current agreement side by side with the surrounding districts on pay, planning time, class size, and health contributions.",
      status: { label: settings.contract_status_note ?? "Talks are not currently open", href: null },
    },
  ] as const;

  return (
    <>
      <header className="civic-page-hero">
        <div className="wrap civic-page-hero-inner">
          <p className="civic-kicker">Reports</p>
          <h1>We publish when the numbers matter.</h1>
          <p className="lede">
            Not on a schedule nobody notices. Each report is reviewed by our advisory
            council before release and offered as a briefing to the union, the board,
            and the press.
          </p>
        </div>
      </header>
      <Photo
        file="how-we-work.jpg"
        alt="Hands holding printed public records and reports"
        ratio="21 / 8"
        sizes="100vw"
        className="civic-photo-band"
        priority
      />

      {groups.length > 0 ? (
        <section className="wrap civic-section" id="on-the-ballot">
          <p className="sub">
            What each issue asks for, what it would fund, and what happens if it fails.
            No recommendation, no endorsement.
          </p>
          {groups.map((group) => (
            <div className="ballot-group" key={group.date} data-ballot-date={group.date}>
              <h2>On the ballot, {group.label}</h2>
              <ul className="ballot-list">
                {group.reports.map((report) => (
                  <li key={report.id}>
                    <Link href={`/reports/${report.slug}`}>
                      <span className="ballot-issue">{report.issueNumber}</span>
                      <span className="ballot-title">{report.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <section className="wrap civic-section">
        <div className="civic-cards">
          {TYPES.map((type) => (
            <article className={`civic-card tone-${type.tone}`} key={type.title}>
              <div className="tag">{type.cadence}</div>
              <h3>{type.title}</h3>
              <p>{type.body}</p>
              <div className="civic-card-foot">
                {type.status.href ? (
                  <a className="more" href={type.status.href}>{type.status.label} &rarr;</a>
                ) : (
                  <span className="unavailable">{type.status.label}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="civic-band civic-band-paper">
        <div className="wrap">
          <h2>All reports</h2>
          <ReportList reports={reports} />
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-note">
          Every report is free to read and share. If you would like a briefing for your
          organization, write to{" "}
          <a href="mailto:hello@monakproject.org">hello@monakproject.org</a>.
        </p>
      </section>
    </>
  );
}
