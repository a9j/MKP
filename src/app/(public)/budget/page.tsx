import type { Metadata } from "next";
import Link from "next/link";
import { BudgetExplorer } from "@/components/explorer/budget-explorer";
import { getCityBudget } from "@/lib/queries/budget";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "City Budget Explorer",
  description:
    "The City of Toledo's adopted budget, by department, what one percent would change, and what it costs per resident. Every figure links to the budget book.",
};

export default async function BudgetPage() {
  const budget = await getCityBudget();
  const loaded = budget.fundYears.length > 0;

  return (
    <>
      <header className="wrap page-head">
        <h1>Where does Toledo&rsquo;s money go?</h1>
        <p className="lede">
          The city&rsquo;s adopted budget, broken into departments a resident can follow.
          Every figure links to the page of the budget book it came from.
        </p>
        <div className="actions">
          <Link className="btn ghost" href="/explorer">
            Teacher Pay Explorer
          </Link>
        </div>
      </header>

      <section className="wrap explorer-section">
        {loaded ? (
          <BudgetExplorer data={budget} />
        ) : (
          <p className="sub">The city budget has not been loaded yet.</p>
        )}
      </section>

      <section className="wrap">
        <h2>Where this comes from.</h2>
        <p className="sub">
          The adopted budget book, published by the City of Toledo, and the population
          figure it is divided by. Nothing here is estimated and nothing is projected
          forward.
        </p>
        <p className="note">
          We show what the budget says. We do not say what it should say.
        </p>
      </section>
    </>
  );
}
