import { createPublicClient } from "@/lib/supabase/public";
import { getSiteSettings } from "@/lib/queries/settings";

/** A figure and the document it came from. Nothing renders without both. */
export type SourcedValue = {
  value: number;
  sourceUrl: string;
};

export type SalaryTable = Record<string, Record<number, SourcedValue>>;

export type BudgetCategory = {
  category: string;
  amount: number;
  sourceUrl: string;
  /** Share of the year's total, 0 to 1, for the proportion bar. */
  share: number;
};

export type Vacancy = {
  position: string;
  building: string | null;
  postedDate: string | null;
  filledDate: string | null;
  /** Calendar days between posting and either filling or the as of date. */
  daysOpen: number | null;
  open: boolean;
  sourceUrl: string;
};

export type InflationBasis = {
  /** The school year being carried forward, for example "2010-2011". */
  baseSchoolYear: string;
  baseCpiYear: number;
  latestCpiYear: number;
  /** latest CPI divided by base CPI. */
  factor: number;
  cpiSourceUrl: string;
  /** Base year salaries for the home district, by lane and step. */
  salaries: SalaryTable;
};

export type ExplorerData = {
  schoolYear: string;
  homeDistrict: string;
  lanes: string[];
  steps: number[];
  /** Comparison districts, home district excluded, alphabetical. */
  districts: string[];
  /** Every district in the latest year, by lane and step. */
  byDistrict: Record<string, SalaryTable>;
  scenarioAPct: number;
  scenarioBFlat: number;
  /** Null when the 2010 schedule or the CPI rows are missing. */
  inflation: InflationBasis | null;
  asOf: string | null;
  sourcesNote: string | null;
};

type SalaryRow = {
  school_year: string;
  district: string;
  lane: string;
  step: number;
  salary: number;
  source_url: string;
};

/**
 * Refuses to return a figure that does not link to a document.
 *
 * The database forbids a null or blank source_url, so reaching this means
 * something got in another way. Public pages are statically rendered, so this
 * throws during the build rather than shipping an unsourced number.
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

/** Sorts "2026-2027" above "2010-2011". */
function latestOf(values: string[]): string | null {
  const sorted = [...new Set(values)].sort();
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

function toTable(rows: SalaryRow[]): Record<string, SalaryTable> {
  const out: Record<string, SalaryTable> = {};
  for (const row of rows) {
    const district = (out[row.district] ??= {});
    const lane = (district[row.lane] ??= {});
    lane[row.step] = { value: Number(row.salary), sourceUrl: row.source_url };
  }
  return out;
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / 86_400_000);
}

export async function getExplorerData(): Promise<ExplorerData> {
  const supabase = createPublicClient();
  const settings = await getSiteSettings();
  const homeDistrict = settings.explorer_home_district ?? "Toledo Public Schools";

  const { data: salaryRows, error: salaryError } = await supabase
    .from("salary_schedule")
    .select("school_year, district, lane, step, salary, source_url");
  if (salaryError) throw new Error(`Could not load the salary schedule: ${salaryError.message}`);
  requireSource(salaryRows ?? [], "salary_schedule");

  const rows = (salaryRows ?? []) as SalaryRow[];
  const schoolYear = latestOf(rows.map((r) => r.school_year));
  if (!schoolYear) {
    throw new Error(
      "The salary_schedule table is empty. Upload a salary schedule CSV from /admin/explorer " +
        "before building, since the Explorer has nothing to show without one.",
    );
  }

  const latestRows = rows.filter((r) => r.school_year === schoolYear);
  const byDistrict = toTable(latestRows);

  const home = byDistrict[homeDistrict];
  if (!home) {
    throw new Error(
      `No ${schoolYear} rows for "${homeDistrict}". Either the CSV spells the district ` +
        `differently or explorer_home_district is set wrong in site_settings.`,
    );
  }

  const lanes = Object.keys(home).sort();
  const steps = [...new Set(Object.values(home).flatMap((l) => Object.keys(l).map(Number)))].sort(
    (a, b) => a - b,
  );
  const districts = Object.keys(byDistrict)
    .filter((d) => d !== homeDistrict)
    .sort();

  // The scenarios are configurable so the fall report can set them.
  const scenarioAPct = Number(settings.scenario_a_pct ?? "3");
  const scenarioBFlat = Number(settings.scenario_b_flat ?? "2000");

  return {
    schoolYear,
    homeDistrict,
    lanes,
    steps,
    districts,
    byDistrict,
    scenarioAPct: Number.isFinite(scenarioAPct) ? scenarioAPct : 3,
    scenarioBFlat: Number.isFinite(scenarioBFlat) ? scenarioBFlat : 2000,
    inflation: await getInflationBasis(rows, homeDistrict),
    asOf: settings.explorer_data_asof ?? null,
    sourcesNote: settings.explorer_sources_list ?? null,
  };
}

/**
 * The 2010 schedule carried forward by CPI.
 *
 * Returns null rather than a guess whenever a piece is missing, because the
 * brief is explicit that a missing 2010 row means hiding the line, not showing
 * a wrong number.
 */
async function getInflationBasis(
  rows: SalaryRow[],
  homeDistrict: string,
): Promise<InflationBasis | null> {
  const baseSchoolYear = rows
    .map((r) => r.school_year)
    .filter((y) => y.startsWith("2010"))
    .sort()[0];
  if (!baseSchoolYear) return null;

  const baseRows = rows.filter(
    (r) => r.school_year === baseSchoolYear && r.district === homeDistrict,
  );
  if (baseRows.length === 0) return null;

  const supabase = createPublicClient();
  const { data: cpiRows, error } = await supabase
    .from("cpi")
    .select("year, index_value, source_url")
    .order("year", { ascending: true });
  if (error) throw new Error(`Could not load CPI: ${error.message}`);
  requireSource(cpiRows ?? [], "cpi");

  const cpi = (cpiRows ?? []).filter((r) => Number(r.index_value) > 0);
  const base = cpi.find((r) => r.year === 2010);
  const latest = cpi.length > 0 ? cpi[cpi.length - 1] : undefined;
  if (!base || !latest || latest.year === base.year) return null;

  return {
    baseSchoolYear,
    baseCpiYear: base.year,
    latestCpiYear: latest.year,
    factor: Number(latest.index_value) / Number(base.index_value),
    cpiSourceUrl: latest.source_url,
    salaries: toTable(baseRows)[homeDistrict] ?? {},
  };
}

export async function getBudgetCategories(): Promise<{
  fiscalYear: string | null;
  categories: BudgetCategory[];
  total: number;
}> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("budget_categories")
    .select("fiscal_year, category, amount, source_url");
  if (error) throw new Error(`Could not load budget categories: ${error.message}`);
  requireSource(data ?? [], "budget_categories");

  const fiscalYear = latestOf((data ?? []).map((r) => r.fiscal_year));
  if (!fiscalYear) return { fiscalYear: null, categories: [], total: 0 };

  const rows = (data ?? []).filter((r) => r.fiscal_year === fiscalYear);
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  return {
    fiscalYear,
    total,
    categories: rows
      .map((r) => ({
        category: r.category,
        amount: Number(r.amount),
        sourceUrl: r.source_url,
        share: total > 0 ? Number(r.amount) / total : 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export async function getVacancies(): Promise<{ asOf: string | null; vacancies: Vacancy[] }> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("vacancies")
    .select("as_of_date, position, building, posted_date, filled_date, source_url");
  if (error) throw new Error(`Could not load vacancies: ${error.message}`);
  requireSource(data ?? [], "vacancies");

  const asOf = latestOf((data ?? []).map((r) => r.as_of_date));
  if (!asOf) return { asOf: null, vacancies: [] };

  const vacancies = (data ?? [])
    .filter((r) => r.as_of_date === asOf)
    .map((r) => {
      const open = !r.filled_date;
      return {
        position: r.position,
        building: r.building,
        postedDate: r.posted_date,
        filledDate: r.filled_date,
        // An open posting is counted up to the as of date, not to today, so the
        // number does not drift between the data being published and being read.
        daysOpen: r.posted_date ? daysBetween(r.posted_date, r.filled_date ?? asOf) : null,
        open,
        sourceUrl: r.source_url,
      };
    })
    .sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1;
      return (b.daysOpen ?? 0) - (a.daysOpen ?? 0);
    });

  return { asOf, vacancies };
}
