import type { Metadata } from "next";
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
      <header className="wrap page-head">
        <h1>What do you actually make? And what would a raise actually cost?</h1>
        <p className="lede">
          The Toledo Teacher Pay Explorer turns Toledo Public Schools&rsquo; salary,
          staffing, and finance data into tools built for the people the numbers
          are about.
        </p>
        <div className="actions">
          {/* Links out when the Explorer has its own home, otherwise scrolls to
              the full widget embedded below. */}
          <a className="btn teal" href={externalExplorer ? externalExplorer : "#explorer"}>
            Open the Explorer
          </a>
          <Link className="btn ghost" href="/reports">
            Read the latest report
          </Link>
        </div>
      </header>

      <section className="wrap explorer-section">
        <PayExplorer data={data} variant="full" id="explorer" />
      </section>

      <section className="wrap" id="features">
        <h2>What the Explorer shows you.</h2>
        <div className="features">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
        <p className="note">
          Every figure in the Explorer links to the public document it came from.
        </p>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>The district budget in plain categories.</h2>
          <BudgetCategories
            fiscalYear={budget.fiscalYear}
            categories={budget.categories}
            total={budget.total}
          />
        </div>
      </section>

      <section className="wrap">
        <h2>Open positions and how long they stay open.</h2>
        <VacanciesTable asOf={vacancies.asOf} vacancies={vacancies.vacancies} />
      </section>

      <section className="wrap">
        <h2>Where this comes from.</h2>
        <p className="sub">
          The Explorer is built and maintained by TeacherRaise and licensed to The
          Mona K Project at no cost. We supply the public records. They supply the
          software.
        </p>
        <p className="note">
          Data current as of {settings.explorer_data_asof ?? "[MONTH YEAR]"}. Sources:
          TPS salary schedules, TPS Five-Year Forecast, Ohio Department of Education
          and Workforce, and {settings.explorer_sources_list ?? "[list]"}.
        </p>
      </section>
    </>
  );
}
