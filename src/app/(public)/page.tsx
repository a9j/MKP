import type { Metadata } from "next";
import Link from "next/link";
import { PayExplorer } from "@/components/explorer/pay-explorer";
import { Photo } from "@/components/photo";
import { getLatestFeed } from "@/lib/queries/feed";
import { getExplorerData } from "@/lib/queries/explorer";
import { getCityBudget } from "@/lib/queries/budget";
import { hasUpcomingBallotExplainer } from "@/lib/queries/explainers";

/**
 * Rebuilt on demand. Every admin save calls revalidatePath for the routes it
 * affects, so a publish shows up within seconds. The long window is only a
 * backstop for anything that misses a revalidate call.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "The Mona K Project. Toledo's public records, explained." },
  description:
    "A Toledo nonprofit that reads school budgets, salary schedules, board votes, and city finances and explains them in plain language. Every number sourced. No positions.",
};

const AUDIENCES = [
  {
    title: "Parents",
    body: "What your school board voted on, what the levy actually asks for, and what happens if it fails. No spin, no recommendation.",
    photo: "for-parents.jpg",
    alt: "A laughing young child rides on a man's shoulders, arms stretched wide and hands held, as a woman reaches up toward the child.",
  },
  {
    title: "Teachers",
    body: "What you make at your step, what each raise proposal would mean for you, and how you'd do in the district next door.",
    photo: "for-teachers.jpg",
    alt: "A teacher at the front of a classroom talks to students at wooden desks, in front of bookshelves, a globe and wall maps.",
  },
  {
    title: "Residents and taxpayers",
    body: "Where the city's money goes, who voted for what, and every records request we've filed to find out.",
    photo: "for-residents.jpg",
    alt: "A tree-lined residential street with parked cars and townhouses, and two people talking on the sidewalk.",
  },
];

type Tool = {
  title: string;
  body: string;
  linkLabel: string;
  href: string;
  /** False shows "Loading soon." in place of the link. */
  live: boolean;
};

const TOOLS: Omit<Tool, "live">[] = [
  {
    title: "Vote Watch",
    body: "Every school board and city council vote that touches money or staffing, in one sentence, with how each member voted.",
    linkLabel: "See the votes",
    href: "/votes",
  },
  {
    title: "Teacher Pay Explorer",
    body: "Enter your step and lane. See what you make, what each scenario would change, and how nearby districts compare.",
    linkLabel: "Open the Explorer",
    href: "/explorer",
  },
  {
    title: "City Budget Explorer",
    body: "Where does Toledo's money go? The adopted budget by department, and what one percent would change.",
    linkLabel: "Open the budget",
    href: "/budget",
  },
  {
    title: "Records Desk",
    body: "Every public records request we've filed, what came back, and a plain guide to filing your own.",
    linkLabel: "See the requests",
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

const PROMISES = [
  {
    lead: "Every number links to its source.",
    rest: "If we can't source it, we don't publish it.",
  },
  {
    lead: "We don't take positions.",
    rest: "We show what the records say and let Toledo decide.",
  },
  {
    lead: "Free, always.",
    rest: "No paywalls, no memberships, no premium reports.",
  },
];

export default async function HomePage() {
  const [latest, explorer, ballotAhead, budget] = await Promise.all([
    getLatestFeed(6),
    getExplorerData(),
    hasUpcomingBallotExplainer(),
    getCityBudget(),
  ]);

  // Every card links through except the city budget before its first load,
  // which keeps its place so the four read as a set. Same test as /budget.
  const tools: Tool[] = TOOLS.map((tool) => ({
    ...tool,
    live: tool.href !== "/budget" || budget.fundYears.length > 0,
  }));

  return (
    <>
      <header className="home-hero">
        <Photo
          file="hero.jpg"
          alt="One Government Center in downtown Toledo at golden hour, the tower lit warm against the evening sky."
          ratio="16 / 9"
          sizes="100vw"
          priority
          className="home-hero-photo"
        />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="wrap home-hero-text">
          <p className="eyebrow">A Toledo nonprofit</p>
          <h1>The records are public. We make them readable.</h1>
          <p className="lede">
            School budgets, salary schedules, board votes, levies, and city
            finances are all public. They arrive as hundreds of pages nobody has
            time for. We turn them into something a parent, a teacher, or a
            taxpayer can understand in four minutes, with every number linked to
            the document it came from.
          </p>
          <div className="actions">
            {ballotAhead ? (
              <Link className="btn" href="/explainers">
                See what&rsquo;s on the ballot
              </Link>
            ) : (
              <Link className="btn" href="/votes">
                See the latest votes
              </Link>
            )}
            <a className="btn ghost" href="#how-we-work">
              How we work
            </a>
          </div>
        </div>
      </header>

      <section className="wrap home-section" id="for">
        <h2>Built for the people the numbers are about.</h2>
        <div className="audiences">
          {AUDIENCES.map((audience) => (
            <div className="audience" key={audience.title}>
              <Photo
                file={audience.photo}
                alt={audience.alt}
                ratio="3 / 2"
                sizes="(max-width: 820px) calc(100vw - 48px), 320px"
                className="photo-small"
              />
              <h3>{audience.title}</h3>
              <p>{audience.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap home-section" id="tools">
        <h2>Four ways in.</h2>
        <div className="tools">
          {tools.map((tool) => (
            <div className="tool" key={tool.title}>
              <h3>{tool.title}</h3>
              <p>{tool.body}</p>
              {tool.live ? (
                <Link className="more" href={tool.href}>
                  {tool.linkLabel}
                </Link>
              ) : (
                <span className="more more-off">Loading soon.</span>
              )}
            </div>
          ))}
        </div>
        <p className="tools-reports">
          Plus reports when the numbers matter: the annual Teacher Pay Report,
          ballot explainers, and contract trackers.{" "}
          <Link href="/reports">Read the reports.</Link>
        </p>
      </section>

      <section className="wrap home-section" id="how-we-work">
        <div className="how">
          <Photo
            file="how-we-work.jpg"
            alt="A person holds up a fanned stack of tax forms and instructions in front of their face, standing against a white wall."
            ratio="4 / 5"
            sizes="(max-width: 900px) calc(100vw - 48px), 440px"
            className="photo-small how-photo"
          />
          <div>
            <h2>How a 400-page PDF becomes a four-minute read.</h2>
            <ol className="how-steps">
              {STEPS.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="band home-band" aria-labelledby="promise-heading">
        <div className="wrap">
          <h2 id="promise-heading" className="visually-hidden">
            Our promise
          </h2>
          <ul className="promises">
            {PROMISES.map((promise) => (
              <li key={promise.lead}>
                <strong>{promise.lead}</strong> {promise.rest}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap home-section" id="latest">
        <h2>Latest.</h2>
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

      <section className="wrap home-section" id="try">
        <h2>Try it. What does a Toledo teacher make?</h2>
        <div className="home-explorer">
          {explorer ? (
            <PayExplorer data={explorer} id="explorer" />
          ) : (
            <div className="explorer" id="explorer">
              <p className="sub">The salary schedule has not been loaded yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="wrap home-section" id="support">
        <div className="cta">
          <div>
            <h2>Help Toledo read its own records.</h2>
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
