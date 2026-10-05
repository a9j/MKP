import type { Metadata } from "next";
import { getImageProps } from "next/image";
import Link from "next/link";
import { PayExplorer } from "@/components/explorer/pay-explorer";
import { Photo } from "@/components/photo";
import { NEUTRALITY_LINE } from "@/lib/nav";
import { getLatestFeed } from "@/lib/queries/feed";
import { getExplorerData } from "@/lib/queries/explorer";
import { getLatestExplainers } from "@/lib/queries/explainers";
import { ExplainerCards } from "@/components/explainers/explainer-cards";

/**
 * Rebuilt on demand. Every admin save calls revalidatePath for the routes it
 * affects, so a publish shows up within seconds. The long window is only a
 * backstop for anything that misses a revalidate call.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  description:
    "The Mona K Project reads Toledo's public records — school budgets, board votes, salaries, city finances, ballot issues — and explains them in plain language. Every number sourced. No positions.",
};

const PROGRAMS = [
  {
    n: "01",
    tone: "navy",
    tag: "Tool",
    title: "Teacher Pay Explorer",
    body: "Enter your step, lane, and years. See what you make, what each raise scenario means for you, and how you'd do in the eight surrounding districts.",
    linkLabel: "Open the Explorer",
    href: "/explorer",
    photo: "for-teachers.jpg",
    alt: "A teacher leading a classroom of students",
  },
  {
    n: "02",
    tone: "teal",
    tag: "Reports",
    title: "Reports",
    body: "The annual Toledo Teacher Pay Report, plain-language explainers for every ballot issue, and a contract tracker when talks open. Sourced, reviewed, no recommendations.",
    linkLabel: "Read the reports",
    href: "/reports",
    photo: "for-parents.jpg",
    alt: "A family laughing together at home",
  },
  {
    n: "03",
    tone: "gold",
    tag: "Records",
    title: "Records Desk and Vote Watch",
    body: "Every public records request we've filed and what came back. Every school board vote that touches money or staffing, and how each member voted.",
    linkLabel: "See the records",
    href: "/records",
    photo: "for-residents.jpg",
    alt: "A quiet residential street lined with houses and trees",
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

const HERO_ALT = "A person holding up a stack of tax and records forms in front of their face.";

/**
 * The hero photo sits behind the words, art directed: the portrait on phones,
 * a widened 16:9 version from 768px with the person on the right and open wall
 * on the left under the text. One <picture> so each width downloads one file.
 */
const { props: heroMobile } = getImageProps({
  src: "/photos/hero-records-desktop.webp",
  alt: HERO_ALT,
  width: 1200,
  height: 1800,
  sizes: "100vw",
  priority: true,
});
const { props: heroWide } = getImageProps({
  src: "/photos/hero-records-wide.webp",
  alt: HERO_ALT,
  width: 2400,
  height: 1350,
  sizes: "100vw",
  priority: true,
});

const TRUST_ITEMS = [
  "Every number links to the document it came from.",
  "No positions. No endorsements. No recommendations.",
  "Free to read, free to share. Always.",
];

export default async function HomePage() {
  const [latest, explorer, explainers] = await Promise.all([
    getLatestFeed(6),
    getExplorerData(),
    getLatestExplainers(3),
  ]);

  return (
    <>
      <header className="home-hero relative isolate overflow-hidden bg-[#F7F5F0] text-[#1B2A3A]">
        <picture>
          <source media="(min-width: 768px)" srcSet={heroWide.srcSet} sizes={heroWide.sizes} />
          <img
            {...heroMobile}
            alt={HERO_ALT}
            className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_70%] md:object-[72%_center]"
          />
        </picture>
        <div className="home-hero-wash absolute inset-0 -z-10" aria-hidden="true" />
        <div className="wrap flex items-center pt-28 pb-16 md:min-h-[90svh] md:py-16">
          <div className="md:w-[55%]">
            <h1 className="text-[clamp(2.5rem,9vw,5rem)] leading-[1.05] font-bold tracking-[-0.02em] text-balance text-[#1B2A3A]">
              The records are public. We make them{" "}
              <span className="home-hero-hl">readable.</span>
            </h1>
            <p className="mt-6 max-w-[34em] text-[18px] leading-[1.6] text-[#1B2A3A]/75">
              School budgets. Board votes. Salary schedules. City finances. Ballot
              issues. We read Toledo&rsquo;s public records, explain them in plain
              language, and link every number to the document it came from. Then
              Toledo decides.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                className="btn btn-large border-2 border-[#D4A84B] bg-[#D4A84B] font-bold text-[#1B2A3A]"
                href="#what-we-do"
              >
                See what we do
              </Link>
              <Link
                className="btn btn-large border-2 border-[#1B2A3A] bg-transparent font-bold text-[#1B2A3A]"
                href="/reports"
              >
                Read the latest
              </Link>
            </div>
            <p className="mt-6 max-w-[44em] text-[14px] text-[#1B2A3A]/60">{NEUTRALITY_LINE}</p>
          </div>
        </div>
      </header>

      <section className="civic-trust" aria-label="Our promises">
        <div className="wrap civic-trust-inner">
          {TRUST_ITEMS.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>

      <section className="wrap civic-everything" id="what-we-do" aria-label="What we do">
        <p className="civic-kicker-dark">What we do</p>
        <h2>
          Not just teacher pay.
          <br />
          <span className="hl-dark">Everything.</span>
        </h2>
        <p className="civic-everything-lede">
          Teacher pay is where we started, because it&rsquo;s where the records
          were clearest. But the mission is bigger: any public record that
          affects Toledo, explained so anyone can understand it.
        </p>
        <div className="civic-programs civic-programs-photo">
          {PROGRAMS.map((program) => (
            <article className={`civic-program-card tone-${program.tone}`} key={program.title}>
              <Photo
                file={program.photo}
                alt={program.alt}
                ratio="16 / 10"
                sizes="(max-width: 700px) 100vw, 50vw"
                className="civic-program-photo"
              />
              <div className="civic-program-card-body">
                <div className="civic-program-n">{program.n}</div>
                <div className="tag">{program.tag}</div>
                <h3>{program.title}</h3>
                <p>{program.body}</p>
                <Link className="more" href={program.href}>
                  {program.linkLabel} <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Fills itself from the newest published explainers, and is absent
          until there is one, so publishing never needs a home page edit. */}
      {explainers.length > 0 ? (
        <section className="civic-band civic-band-paper" aria-labelledby="home-explainers">
          <div className="wrap">
            <p className="civic-kicker-dark">Explainers</p>
            <h2 id="home-explainers">On the ballot and at the table</h2>
            <ExplainerCards explainers={explainers} />
            <p className="explainer-all">
              <Link className="more" href="/explainers">
                All explainers <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      <section className="civic-steps">
        <div className="wrap civic-steps-grid">
          <div>
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
          <Photo
            file="records-folders.jpg"
            alt="Stacks of manila folders holding public records"
            ratio="3 / 4"
            sizes="(max-width: 900px) 100vw, 40vw"
            className="civic-steps-photo"
          />
        </div>
      </section>

      <section className="wrap civic-explorer" id="explorer">
        <p className="civic-kicker-dark">One example</p>
        <h2>Start with a paycheck.</h2>
        <p className="civic-explorer-lede">
          The Teacher Pay Explorer is the first tool. More are coming: the city
          budget, board votes, ballot issues. This is what &ldquo;readable&rdquo;
          looks like.
        </p>
        {explorer ? (
          <PayExplorer data={explorer} id="explorer" />
        ) : (
          <p className="civic-empty">
            The pay data hasn&rsquo;t been published yet. Check back soon.
          </p>
        )}
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
