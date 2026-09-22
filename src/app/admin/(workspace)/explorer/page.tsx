import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CsvUploader } from "@/components/admin/csv-uploader";
import { CpiEditor } from "@/components/admin/cpi-editor";
import { DATASETS } from "@/lib/explorer-import";

// Reads the session, so it is never cached.
export const dynamic = "force-dynamic";

export default async function AdminExplorerPage() {
  const admin = await getAdminUser();

  if (!admin) {
    return (
      <>
        <h1>Explorer data</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a> to upload data.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const { data: cpi } = await supabase
    .from("cpi")
    .select("year, index_value, source_url")
    .order("year", { ascending: true });

  return (
    <>
      <h1>Explorer data</h1>
      <p className="admin-help">
        Every upload is checked before anything is written. A row without a source link
        is refused, and a file with any problem in it is refused whole.
      </p>

      <CsvUploader
        dataset="salary_schedule"
        label={DATASETS.salary_schedule.label}
        columns={DATASETS.salary_schedule.columns.map((c) => c.name)}
        help="One row per school year, district, lane and step. Uploading again updates the rows in the file and leaves the rest alone."
      />

      <CsvUploader
        dataset="vacancies"
        label={DATASETS.vacancies.label}
        columns={DATASETS.vacancies.columns.map((c) => c.name)}
        help="A monthly snapshot. Leave filled_date empty for a posting that is still open."
      />

      <CsvUploader
        dataset="budget_categories"
        label={DATASETS.budget_categories.label}
        columns={DATASETS.budget_categories.columns.map((c) => c.name)}
        help="One row per fiscal year and category. The Explorer shows the most recent fiscal year."
      />

      <CsvUploader
        dataset="city_budget"
        label={DATASETS.city_budget.label}
        columns={DATASETS.city_budget.columns.map((c) => c.name)}
        help="The adopted budget book from toledo.oh.gov. One row per fiscal year, fund, department and category. source_page is the page of the book the figure is on, and may be left empty."
      />

      <CsvUploader
        dataset="city_population"
        label={DATASETS.city_population.label}
        columns={DATASETS.city_population.columns.map((c) => c.name)}
        help="One row per year. The most recent year is what per resident figures on /budget divide by, so it carries its own source."
      />

      <CpiEditor rows={(cpi ?? []).map((r) => ({ ...r, index_value: Number(r.index_value) }))} />
    </>
  );
}
