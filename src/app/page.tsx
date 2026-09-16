import type { Metadata } from "next";
import Link from "next/link";
import { PayExplorerPreview } from "@/components/pay-explorer-preview";
import { NEUTRALITY_LINE } from "@/lib/nav";
import { getLatestFeed } from "@/lib/queries/feed";

/**
 * Rebuilt on demand. Every admin save calls revalidatePath for the routes it
 * affects, so a publish shows up within seconds. The long window is only a
 * backstop for anything that misses a revalidate call.
 */
export const revalidate = 3600;

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

export default async function HomePage() {
  const latest = await getLatestFeed(6);

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
          {latest.map((entry) => (
            <Link className="item" href={entry.href} key={`${entry.kind}-${entry.date}-${entry.title}`}>
              <span className="date">{entry.dateLabel}</span>
              <span className="kind">{entry.kindLabel}</span>
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
