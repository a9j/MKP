import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import { ReportList } from "@/components/public/report-list";
import { getPublishedReports } from "@/lib/queries/reports";
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
  const levies = reports.filter((r) => r.type === "levy_explainer");

  /** Report types, verbatim from the copy doc. */
  const TYPES = [
    {
      tone: "navy",
      title: "The Toledo Teacher Pay Report",
      cadence: "Every fall",
      body: "What TPS teachers earn at each step, how that compares to nearby districts and to inflation, what the district's finances actually look like, and three sourced raise scenarios with what each would cost.",
      status: latestPayReport
        ? { label: `Read the ${latestPayReport.reportDate.slice(0, 4)} report`, href: `/reports/${latestPayReport.slug}` }
        : { label: settings.reports_next_report_note || "Coming November 2026", href: null },
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
      status:
        levies.length > 1
          ? { label: `Read the ${levies.length} levy explainers`, href: "#levy-explainers" }
          : levies.length === 1
            ? { label: "Read the levy explainer", href: `/reports/${levies[0].slug}` }
            : { label: settings.levy_status_note || "No levy currently on the ballot", href: null },
    },
    {
      tone: "navy",
      title: "Contract Tracker",
      cadence: "When contract talks open",
      body: "The current agreement side by side with the surrounding districts on pay, planning time, class size, and health contributions.",
      status: { label: settings.contract_status_note || "Talks are not currently open", href: null },
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

      {levies.length > 1 ? (
        <section className="wrap civic-section" id="levy-explainers">
          <h2>Levy explainers for November 3</h2>
          <p className="sub">One page per levy. What it asks for, what it costs, and what each side says. No recommendation.</p>
          <div className="civic-cards">
            {levies.map((levy) => (
              <article className="civic-card tone-gold" key={levy.id}>
                <div className="tag">{levy.reportDateLabel}</div>
                <h3>{levy.title}</h3>
                <div className="civic-card-foot">
                  <a className="more" href={`/reports/${levy.slug}`}>Read the explainer &rarr;</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
