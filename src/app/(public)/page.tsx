import type { Metadata } from "next";
import Link from "next/link";
import { PayExplorer } from "@/components/explorer/pay-explorer";
import { NEUTRALITY_LINE } from "@/lib/nav";
import { getLatestFeed } from "@/lib/queries/feed";
import { getExplorerData } from "@/lib/queries/explorer";

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
    n: "01",
    tone: "navy",
    tag: "Tool",
    title: "Teacher Pay Explorer",
    body: "Enter your step, lane, and years. See what you make, what each raise scenario means for you, and how you'd do in the eight surrounding districts.",
    linkLabel: "Open the Explorer",
    href: "/explorer",
  },
  {
    n: "02",
    tone: "teal",
    tag: "Reports",
    title: "Reports",
    body: "The annual Toledo Teacher Pay Report, levy explainers when something is on the ballot, and a contract tracker when talks open. Sourced, reviewed, no recommendations.",
    linkLabel: "Read the reports",
    href: "/reports",
  },
  {
    n: "03",
    tone: "gold",
    tag: "Records",
    title: "Records Desk and Vote Watch",
    body: "Every public records request we've filed and what came back. Every school board vote that touches money or staffing, and how each member voted.",
    linkLabel: "See the records",
    href: "/records",
  },
] as const;

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

const TRUST_ITEMS = [
  "Every number links to the document it came from.",
  "No positions. No endorsements. No recommendations.",
  "Free to read, free to share. Always.",
];

export default async function HomePage() {
  const [latest, explorer] = await Promise.all([getLatestFeed(6), getExplorerData()]);

  return (
    <>
      <header className="civic-hero">
        <div className="wrap civic-hero-inner">
          <p className="civic-kicker">The Mona K Project &mdash; Toledo, Ohio</p>
          <h1>
            The records are public.
            <br />
            We make them <span className="hl">readable.</span>
          </h1>
          <p className="lede">
            We read Toledo&rsquo;s school budgets, salary schedules, board votes, and
            city finances, then explain them in plain language. Every number links
            to the document it came from. We show what the records say and let
            Toledo decide.
          </p>
          <div className="actions">
            <Link className="btn btn-gold btn-large" href="/explorer">
              See what you make
            </Link>
            <Link className="btn btn-outline-w btn-large" href="/reports">
              Read the latest report
            </Link>
          </div>
          <p className="pledge">{NEUTRALITY_LINE}</p>
        </div>
      </header>

      <section className="civic-trust" aria-label="Our promises">
        <div className="wrap civic-trust-inner">
          {TRUST_ITEMS.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>

      <section className="wrap civic-explorer" id="explorer">
        <p className="civic-kicker-dark">Start with your paycheck</p>
        <h2>What do you actually make?</h2>
        <PayExplorer data={explorer} id="explorer" />
      </section>

      <section className="civic-programs" aria-label="What we build">
        {PROGRAMS.map((program) => (
          <div className={`civic-program tone-${program.tone}`} key={program.title}>
            <div className="civic-program-n">{program.n}</div>
            <div className="tag">{program.tag}</div>
            <h3>{program.title}</h3>
            <p>{program.body}</p>
            <Link className="more" href={program.href}>
              {program.linkLabel} <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        ))}
      </section>

      <section className="civic-steps">
        <div className="wrap">
          <p className="civic-kicker">How it works</p>
          <h2>How a 400-page PDF becomes a four-minute read.</h2>
          <ol>
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="civic-step-n">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
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

      <section className="civic-cta">
        <div className="wrap">
          <h2>Help us read the next 400 pages.</h2>
          <p>
            The Mona K Project runs on small donations and volunteer hours. Every
            dollar goes to records requests, review, and publishing.
          </p>
          <div className="actions">
            <Link className="btn btn-gold btn-large" href="/get-involved">
              Donate
            </Link>
            <Link className="btn btn-outline-w btn-large" href="/get-involved">
              Join the advisory council
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
