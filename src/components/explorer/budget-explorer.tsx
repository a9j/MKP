"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Sourced } from "@/components/sourced";
import { usd } from "@/lib/format";
import { DEFAULT_FUND, type CityBudget } from "@/lib/queries/budget";

// Recharts is only drawn when two or more years are loaded, so it is loaded
// on demand rather than shipped to everyone who opens the page.
const BudgetTrend = dynamic(
  () => import("@/components/explorer/budget-trend").then((m) => m.BudgetTrend),
  { ssr: false, loading: () => <div className="chart-loading">Loading the chart</div> },
);

/** A percentage reads as a percentage, not as 2.5000000001. */
function pct(value: number): string {
  return `${Number(value.toFixed(1))}`;
}

export function BudgetExplorer({ data }: { data: CityBudget }) {
  const [fund, setFund] = useState(
    () => (data.funds.includes(DEFAULT_FUND) ? DEFAULT_FUND : data.funds[0]) ?? "",
  );
  const [fiscalYear, setFiscalYear] = useState(() => data.fiscalYears[0] ?? 0);
  const [share, setShare] = useState(1);

  const selected = data.fundYears.find(
    (entry) => entry.fund === fund && entry.fiscalYear === fiscalYear,
  );

  const [department, setDepartment] = useState<string | null>(null);
  const trendDepartment = department ?? selected?.departments[0]?.department ?? null;

  // Every year this department appears in, for the year over year panel.
  const trend = useMemo(() => {
    if (!trendDepartment) return [];
    return data.fundYears
      .filter((entry) => entry.fund === fund)
      .map((entry) => {
        const match = entry.departments.find((d) => d.department === trendDepartment);
        return match
          ? { fiscalYear: entry.fiscalYear, amount: match.amount, sourceUrl: match.sourceUrl }
          : null;
      })
      .filter((row): row is { fiscalYear: number; amount: number; sourceUrl: string } => row !== null)
      .sort((a, b) => a.fiscalYear - b.fiscalYear);
  }, [data.fundYears, fund, trendDepartment]);

  if (!selected) {
    return <p className="sub">The city budget has not been loaded yet.</p>;
  }

  const moved = (selected.total * share) / 100;
  // The departments this amount would cover outright, smallest first. Three of
  // them, because a list of thirty is a table, not a comparison.
  const exceeds = [...selected.departments]
    .filter((d) => d.amount < moved)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, 3);

  const perResident = data.population ? selected.total / data.population.population : null;

  return (
    <div className="budget-explorer">
      <div className="budget-controls">
        <div className="field">
          <label htmlFor="budget-fund">Fund</label>
          <select id="budget-fund" value={fund} onChange={(event) => setFund(event.target.value)}>
            {data.funds.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="budget-year">Fiscal year</label>
          <select
            id="budget-year"
            value={fiscalYear}
            onChange={(event) => setFiscalYear(Number(event.target.value))}
          >
            {data.fiscalYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="budget-panel">
        <h2>Where the {selected.fund} goes</h2>
        <p className="sub">
          Fiscal year {selected.fiscalYear}, by department, largest first. The fund totals{" "}
          {selected.sourceUrl ? (
            <Sourced href={selected.sourceUrl}>{usd(selected.total)}</Sourced>
          ) : (
            usd(selected.total)
          )}
          .
        </p>

        <ul className="budget-bars">
          {selected.departments.map((entry) => (
            <li key={entry.department}>
              <span className="budget-bar-head">
                <span className="budget-dept">{entry.department}</span>
                <span className="budget-amount">
                  <Sourced href={entry.sourceUrl}>{usd(entry.amount)}</Sourced>
                  <small>{(entry.share * 100).toFixed(1)}% of the fund</small>
                </span>
              </span>
              <span className="bar" aria-hidden="true">
                <span className="bar-fill" style={{ width: `${(entry.share * 100).toFixed(1)}%` }} />
              </span>
              {entry.sourcePage ? (
                <span className="budget-page">Budget book, page {entry.sourcePage}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="budget-panel">
        <h2>What one percent would change</h2>
        <div className="field budget-slider">
          <label htmlFor="budget-share">Share of the {selected.fund}</label>
          <input
            id="budget-share"
            type="range"
            min={0.5}
            max={5}
            step={0.1}
            value={share}
            onChange={(event) => setShare(Number(event.target.value))}
            aria-describedby="budget-share-figure"
          />
          <output htmlFor="budget-share">{pct(share)} percent</output>
        </div>

        <p className="lab">If {pct(share)} percent moved, it would equal</p>
        {/* Derived from the sourced total rather than read off a page, so it
            carries no gold underline. The total above it does. */}
        <p className="big" id="budget-share-figure">
          {usd(moved)}
        </p>

        {exceeds.length > 0 ? (
          <>
            <p className="sub">That is more than the whole budget of:</p>
            <ul className="budget-exceeds">
              {exceeds.map((entry) => (
                <li key={entry.department}>
                  {entry.department}, <Sourced href={entry.sourceUrl}>{usd(entry.amount)}</Sourced>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="sub">
            That is less than every department in this fund.
          </p>
        )}
        <p className="note">
          A comparison, not a proposal. The Mona K Project does not recommend moving
          anything.
        </p>
      </section>

      <section className="budget-panel">
        <h2>Per resident</h2>
        {perResident !== null && data.population ? (
          <>
            <p className="lab">The {selected.fund} works out to</p>
            <p className="big">{usd(perResident)}</p>
            <p className="sub">
              for every resident. The fund total of{" "}
              {selected.sourceUrl ? (
                <Sourced href={selected.sourceUrl}>{usd(selected.total)}</Sourced>
              ) : (
                usd(selected.total)
              )}{" "}
              divided by a {data.population.year} population of{" "}
              <Sourced href={data.population.sourceUrl}>
                {data.population.population.toLocaleString("en-US")}
              </Sourced>
              .
            </p>
            <p className="note">
              The division is ours. Both numbers it uses link to the document they came
              from.
            </p>
          </>
        ) : (
          <p className="sub">
            The city population has not been loaded yet, so there is nothing to divide
            by.
          </p>
        )}
      </section>

      {trend.length > 1 && trendDepartment ? (
        <section className="budget-panel">
          <h2>Year over year</h2>
          <div className="field">
            <label htmlFor="budget-department">Department</label>
            <select
              id="budget-department"
              value={trendDepartment}
              onChange={(event) => setDepartment(event.target.value)}
            >
              {selected.departments.map((entry) => (
                <option key={entry.department} value={entry.department}>
                  {entry.department}
                </option>
              ))}
            </select>
          </div>
          <BudgetTrend department={trendDepartment} fund={selected.fund} rows={trend} />
        </section>
      ) : null}
    </div>
  );
}
