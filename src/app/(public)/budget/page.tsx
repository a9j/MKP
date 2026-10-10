import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { env } from "@/lib/env";
import { breadcrumbLd, datasetLd, graph, pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { BudgetExplorer } from "@/components/explorer/budget-explorer";
import { getCityBudget } from "@/lib/queries/budget";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Toledo City Budget Explorer: Where the Money Goes",
  description:
    "Where does Toledo's money go? The City of Toledo's adopted budget by fund and department, what one percent would change, and the cost per resident. Every figure links to the budget book.",
  path: "/budget",
});

export default async function BudgetPage() {
  const budget = await getCityBudget();
  const loaded = budget.fundYears.length > 0;

  const sourceUrls = new Set<string>();
  for (const fy of budget.fundYears) {
    if (fy.sourceUrl) sourceUrls.add(fy.sourceUrl);
    for (const d of fy.departments) sourceUrls.add(d.sourceUrl);
  }
  if (budget.population) sourceUrls.add(budget.population.sourceUrl);
  const years = [...budget.fiscalYears].sort((a, b) => a - b);
  const dataset = datasetLd(env.siteUrl, {
    path: "/budget",
    name: "City of Toledo Adopted Budget by Fund and Department",
    description:
      "The City of Toledo, Ohio adopted operating budget broken down by fund and department, with the cost per resident. Every figure links to the page of the city budget book it came from.",
    keywords: [
      "City of Toledo budget",
      "Toledo general fund",
      "Toledo city spending",
      "municipal budget",
      "Toledo Ohio",
    ],
    sources: [...sourceUrls].slice(0, 20).map((url) => ({ name: "City of Toledo budget book", url })),
    ...(years.length > 0
      ? { temporalCoverage: years.length > 1 ? `${years[0]}/${years[years.length - 1]}` : `${years[0]}` }
      : {}),
  });

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbLd(env.siteUrl, [{ name: "City Budget Explorer", path: "/budget" }]),
          dataset,
        )}
      />
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
