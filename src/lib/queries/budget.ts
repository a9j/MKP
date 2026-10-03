import { createPublicClient } from "@/lib/supabase/public";

/**
 * The City of Toledo adopted budget, as the Budget Explorer reads it.
 *
 * Every figure carries the document it came from, and the page of that document
 * where it can be checked, so nothing on the page has to be taken on trust. An
 * empty table is an empty page, never a failed build: the site has to survive
 * the day before the budget book is loaded.
 */

export type BudgetDepartment = {
  department: string;
  amount: number;
  sourceUrl: string;
  sourcePage: number | null;
  /** Share of the selected fund, 0 to 1. */
  share: number;
};

export type BudgetFundYear = {
  fiscalYear: number;
  fund: string;
  total: number;
  /**
   * The document the whole fund came from, when every row in it names the same
   * one. Null when the rows were loaded from more than one document, in which
   * case the total links to nothing and the departments carry their own links.
   */
  sourceUrl: string | null;
  departments: BudgetDepartment[];
};

export type Population = {
  year: number;
  population: number;
  sourceUrl: string;
};

export type CityBudget = {
  /** Every fund that has at least one row, alphabetical. */
  funds: string[];
  /** Every fiscal year that has at least one row, newest first. */
  fiscalYears: number[];
  /** One entry per fund and year that has rows. */
  fundYears: BudgetFundYear[];
  population: Population | null;
};

type BudgetRow = {
  fiscal_year: number;
  fund: string;
  department: string;
  category: string;
  amount: number;
  source_url: string;
  source_page: number | null;
};

/** The fund a reader means when they say "the city budget". */
export const DEFAULT_FUND = "General Fund";

/**
 * Refuses a figure that does not link to a document.
 *
 * The database forbids a blank source_url, so reaching this means a row got in
 * another way. This throws rather than hiding the row: an empty table is a
 * page that says so, but a figure with no source is the one thing that must
 * never reach a reader.
 */
function requireSource(rows: { source_url: string | null }[], table: string): void {
  const unsourced = rows.filter((r) => !r.source_url || r.source_url.trim().length === 0);
  if (unsourced.length > 0) {
    throw new Error(
      `${unsourced.length} row(s) in ${table} have no source_url. ` +
        `Every published figure must link to the document it came from, so the ` +
        `build is stopped. Fix the rows or re-upload the CSV.`,
    );
  }
}

export async function getCityBudget(): Promise<CityBudget> {
  const supabase = createPublicClient();

  const [{ data: budgetRows, error: budgetError }, { data: populationRows, error: populationError }] =
    await Promise.all([
      supabase
        .from("city_budget")
        .select("fiscal_year, fund, department, category, amount, source_url, source_page"),
      supabase.from("city_population").select("year, population, source_url").order("year"),
    ]);

  if (budgetError) throw new Error(`Could not load the city budget: ${budgetError.message}`);
  if (populationError) {
    throw new Error(`Could not load the city population: ${populationError.message}`);
  }
  requireSource(budgetRows ?? [], "city_budget");
  requireSource(populationRows ?? [], "city_population");

  const rows = (budgetRows ?? []) as BudgetRow[];
  const funds = [...new Set(rows.map((r) => r.fund))].sort();
  const fiscalYears = [...new Set(rows.map((r) => Number(r.fiscal_year)))].sort((a, b) => b - a);

  // A department is the sum of its categories within one fund and year. The
  // categories are kept in the table so a figure can be traced back to the
  // line it came from, but the panel a resident reads is by department.
  const grouped = new Map<string, Map<string, BudgetRow[]>>();
  for (const row of rows) {
    const key = `${row.fiscal_year}␟${row.fund}`;
    const byDepartment = grouped.get(key) ?? new Map<string, BudgetRow[]>();
    byDepartment.set(row.department, [...(byDepartment.get(row.department) ?? []), row]);
    grouped.set(key, byDepartment);
  }

  const fundYears: BudgetFundYear[] = [];
  for (const [key, byDepartment] of grouped) {
    const [year, fund] = key.split("␟");
    const departments = [...byDepartment.entries()].map(([department, departmentRows]) => {
      const amount = departmentRows.reduce((sum, r) => sum + Number(r.amount), 0);
      // The largest line in the department is the one worth linking to: it is
      // the page a reader checking the figure would want to open first.
      const largest = [...departmentRows].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      return {
        department,
        amount,
        sourceUrl: largest.source_url,
        sourcePage: largest.source_page,
        share: 0,
      };
    });

    const total = departments.reduce((sum, d) => sum + d.amount, 0);
    for (const department of departments) {
      department.share = total > 0 ? department.amount / total : 0;
    }

    const urls = new Set(
      [...byDepartment.values()].flat().map((r) => r.source_url),
    );

    fundYears.push({
      fiscalYear: Number(year),
      fund,
      total,
      sourceUrl: urls.size === 1 ? [...urls][0] : null,
      departments: departments.sort((a, b) => b.amount - a.amount),
    });
  }

  const population = (populationRows ?? []).at(-1);

  return {
    funds,
    fiscalYears,
    fundYears: fundYears.sort(
      (a, b) => b.fiscalYear - a.fiscalYear || a.fund.localeCompare(b.fund),
    ),
    population: population
      ? {
          year: Number(population.year),
          population: Number(population.population),
          sourceUrl: population.source_url,
        }
      : null,
  };
}
