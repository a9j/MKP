import type { Metadata } from "next";
import { Photo } from "@/components/photo";
import Link from "next/link";
import { PayExplorer } from "@/components/explorer/pay-explorer";
import { BudgetCategories } from "@/components/explorer/budget-categories";
import { VacanciesTable } from "@/components/explorer/vacancies-table";
import {
  getExplorerData,
  getBudgetCategories,
  getVacancies,
} from "@/lib/queries/explorer";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Explorer",
  description:
    "See what Toledo Public Schools teachers earn at every step, what each raise scenario would cost, and how TPS compares to eight surrounding districts.",
};

/** Feature blocks from mona-k-project-site-copy.md, Explorer section. */
const FEATURES = [
  {
    title: "Your pay, today and under each scenario",
    body: "Enter your step, lane, and years of service. See your current salary, what each raise scenario would mean for you in dollars, and how you would do in the eight surrounding districts.",
  },
  {
    title: "Every step since 2010, adjusted for inflation",
    body: "See how each step on the schedule has moved over time in real dollars. Not the number on the page, the number in your pocket.",
  },
  {
    title: "The district budget in plain categories",
    body: "See where TPS money goes, broken into categories a parent can follow, and what moving one percent from one line to another would change.",
  },
  {
    title: "Open positions and how long they stay open",
    body: "See current vacancies and how long each has gone unfilled. Updated monthly.",
  },
];

export default async function ExplorerPage() {
  const [data, budget, vacancies, settings] = await Promise.all([
    getExplorerData(),
    getBudgetCategories(),
    getVacancies(),
    getSiteSettings(),
  ]);

  const externalExplorer = settings.explorer_url;

  return (
    <>
      <header className="civic-page-hero">
        <div className="wrap civic-page-hero-inner">
          <p className="civic-kicker">Explorer</p>
          <h1>What do you actually make? And what would a raise actually cost?</h1>
          <p className="lede">
            The Toledo Teacher Pay Explorer turns Toledo Public Schools&rsquo; salary,
            staffing, and finance data into tools built for the people the numbers
            are about.
          </p>
          <div className="actions">
            {/* Links out when the Explorer has its own home, otherwise scrolls to
                the full widget embedded below. */}
            <a className="btn btn-gold" href={externalExplorer ? externalExplorer : "#explorer"}>
              Open the Explorer
            </a>
            <Link className="btn btn-outline-w" href="/budget">
              City Budget Explorer
            </Link>
            <Link className="btn btn-outline-w" href="/reports">
              Read the latest report
            </Link>
          </div>
        </div>
      </header>
      <Photo
        file="for-teachers.jpg"
        alt="A teacher in a Toledo classroom"
        ratio="21 / 8"
        sizes="100vw"
        className="civic-photo-band"
        priority
      />

      <section className="wrap civic-section">
        {data ? (
          <PayExplorer data={data} variant="full" id="explorer" />
        ) : (
          <p className="civic-empty" id="explorer">
            The salary schedule has not been loaded yet.
          </p>
        )}
      </section>

      <section className="wrap civic-section" id="features">
        <p className="civic-kicker-dark">Features</p>
        <h2>What the Explorer shows you.</h2>
        {/* A ul, not an ol: these four are things the Explorer does, in no
            particular order, so numbering them stated a sequence that is not
            there. */}
        <ul className="civic-points">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
        <p className="civic-note">
          Every figure in the Explorer links to the public document it came from.
        </p>
      </section>

      <section className="civic-band civic-band-paper">
        <div className="wrap">
          <h2>The district budget in plain categories.</h2>
          <BudgetCategories
            fiscalYear={budget.fiscalYear}
            categories={budget.categories}
            total={budget.total}
          />
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">Staffing</p>
        <h2>Open positions and how long they stay open.</h2>
        <VacanciesTable asOf={vacancies.asOf} vacancies={vacancies.vacancies} />
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">Sources</p>
        <h2>Where this comes from.</h2>
        <p className="civic-section-lede">
          The Explorer is built and maintained by TeacherRaise and licensed to The
          Mona K Project at no cost. We supply the public records. They supply the
          software.
        </p>
        <p className="civic-note">
          Data current as of {settings.explorer_data_asof ?? "[MONTH YEAR]"}. Sources:
          TPS salary schedules, TPS Five-Year Forecast, Ohio Department of Education
          and Workforce, and {settings.explorer_sources_list ?? "[list]"}.
        </p>
      </section>
    </>
  );
}
