import { Sourced } from "@/components/sourced";
import { usd } from "@/lib/format";
import type { BudgetCategory } from "@/lib/queries/explorer";

type Props = {
  fiscalYear: string | null;
  categories: BudgetCategory[];
  total: number;
};

/** Hairline rows with a proportion bar. No cards, no shadows. */
export function BudgetCategories({ fiscalYear, categories, total }: Props) {
  if (!fiscalYear || categories.length === 0) {
    return <p className="sub">No budget categories have been published yet.</p>;
  }

  return (
    <div className="budget">
      <table className="data-table">
        <caption>
          Fiscal year {fiscalYear}. Every figure links to the document it came from.
        </caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Share</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.category}>
              <th scope="row">{c.category}</th>
              <td>
                <span className="bar-cell">
                  <span className="bar" aria-hidden="true">
                    <span className="bar-fill" style={{ width: `${(c.share * 100).toFixed(1)}%` }} />
                  </span>
                  <span className="bar-pct">{(c.share * 100).toFixed(1)}%</span>
                </span>
              </td>
              <td>
                <Sourced href={c.sourceUrl}>{usd(c.amount)}</Sourced>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td />
            <td>{usd(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
