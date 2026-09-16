import type { Metadata } from "next";
import Link from "next/link";
import { PayExplorerPreview } from "@/components/pay-explorer-preview";
import { NEUTRALITY_LINE } from "@/lib/nav";

export const metadata: Metadata = {
  description:
    "The Mona K Project reads Toledo's school budgets, salary schedules, board votes, and city finances and explains them in plain language. Every number sourced. No positions.",
};

/** Programs copy from mona-k-project-site-copy.md, Home section. */
const PROGRAMS = [
  {
    tag: "Tool",
    title: "Teacher Pay Explorer",
    body: "Enter your step, lane, and years. See what you make, what each raise scenario means for you, and how you'd do in the eight surrounding districts.",
    linkLabel: "Open the Explorer",
    href: "/explorer",
  },
  {
    tag: "Reports",
    title: "Reports",
    body: "The annual Toledo Teacher Pay Report, levy explainers when something is on the ballot, and a contract tracker when talks open. Sourced, reviewed, no recommendations.",
    linkLabel: "Read the reports",
    href: "/reports",
  },
  {
    tag: "Records",
    title: "Records Desk and Vote Watch",
    body: "Every public records request we've filed and what came back. Every school board vote that touches money or staffing, and how each member voted.",
    linkLabel: "See the records",
    href: "/records",
  },
];

const STEPS = [
  {
    title: "We file the request",
    body: "Under Ohio's Public Records Act. Every request is logged publicly.",
  },
  {
    title: "We read every page",
    body: "Budgets, schedules, minutes, forecasts. All of it.",
  },
  {
    title: "We explain it plainly",
    body: "With every figure linked to the page it came from.",
  },
  {
    title: "The council reviews it",
    body: "Teachers, parents, and accountants read it before anyone else.",
  },
  {
    title: "We publish and brief",
    body: "Free to everyone. Offered as a briefing to the union, the board, and the press.",
  },
];

/**
 * Phase 1 sample feed. Phase 2 replaces this with the six most recent rows of
 * the latest_feed view.
 */
const LATEST = [
  {
    date: "Sep 12, 2026",
    kind: "Vote Watch",
    title: "Board approves $4.2M HVAC contract for six buildings",
    subtitle: "Passed 4 to 1. Summary and each member's vote.",
    action: "Read",
    href: "/votes",
  },
  {
    date: "Sep 3, 2026",
    kind: "Records Desk",
    title: "TPS 2026-27 certified salary schedule",
    subtitle: "Filed Aug 18. Fulfilled in 11 business days. 42 pages.",
    action: "Open",
    href: "/records",
  },
  {
    date: "Aug 29, 2026",
    kind: "Vote Watch",
    title: "Board adds four intervention specialist positions",
    subtitle: "Passed 5 to 0. Summary and each member's vote.",
    action: "Read",
    href: "/votes",
  },
  {
    date: "Aug 21, 2026",
    kind: "Listening",
    title: "What 31 teachers told us in August",
    subtitle: "Planning time and health premiums came up more than base pay.",
    action: "Read",
    href: "/listening",
  },
  {
    date: "Aug 14, 2026",
    kind: "Records Desk",
    title: "City of Toledo general fund monthly report",
    subtitle: "Filed Jul 30. Fulfilled in 9 business days. 18 pages.",
    action: "Open",
    href: "/records",
  },
  {
    date: "Coming Nov",
    kind: "Report",
    title: "The 2026 Toledo Teacher Pay Report",
    subtitle: "Every step, eight districts, inflation, three costed scenarios.",
    action: "Notify me",
    href: "/reports",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="wrap hero">
        <div>
          <h1>The records are public. Now they&rsquo;re readable.</h1>
          <p className="lede">
            We read Toledo&rsquo;s school budgets, salary schedules, board votes, and
            city finances, then explain them in plain language. Every number links
            to the document it came from. We show what the records say and let
            Toledo decide.
          </p>
          <div className="actions">
            <Link className="btn teal" href="/explorer">
              See what you make
            </Link>
            <Link className="btn ghost" href="/reports">
              Read the latest report
            </Link>
          </div>
          <p className="pledge">{NEUTRALITY_LINE}</p>
        </div>

        <PayExplorerPreview />
      </header>

      <section className="wrap" id="programs">
        <h2>Three things we build, all from public records.</h2>
        <div className="programs">
          {PROGRAMS.map((program) => (
            <div className="program" key={program.title}>
              <div className="tag">{program.tag}</div>
              <h3>{program.title}</h3>
              <p>{program.body}</p>
              <Link className="more" href={program.href}>
                {program.linkLabel}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>How a 400-page PDF becomes a four-minute read.</h2>
          <div className="steps">
            {STEPS.map((step) => (
              <div className="step" key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap">
        <h2>Latest from The Mona K Project</h2>
        <div className="latest">
          {LATEST.map((entry) => (
            <Link className="item" href={entry.href} key={entry.title}>
              <span className="date">{entry.date}</span>
              <span className="kind">{entry.kind}</span>
              <span className="t">
                {entry.title}
                <small>{entry.subtitle}</small>
              </span>
              <span className="go">{entry.action}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap" id="support">
        <div className="cta">
          <div>
            <h2>Help us read the next 400 pages.</h2>
            <p>
              The Mona K Project runs on small donations and volunteer hours. Every
              dollar goes to records requests, review, and publishing.
            </p>
          </div>
          <div className="actions">
            <Link className="btn" href="/get-involved">
              Donate
            </Link>
            <Link className="btn ghost" href="/get-involved">
              Join the advisory council
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
