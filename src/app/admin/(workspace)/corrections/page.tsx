import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CorrectionForm } from "@/components/admin/correction-form";
import { formatDay } from "@/lib/queries/records";
import { NotSignedIn } from "@/components/admin/not-signed-in";

export const dynamic = "force-dynamic";

export default async function AdminCorrectionsPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Corrections" />;

  const supabase = await createServerSupabase();
  const { data: corrections } = await supabase
    .from("corrections")
    .select("id, correction_date, page_path, what_changed, why")
    .order("correction_date", { ascending: false });

  return (
    <>
      <h1>Corrections</h1>
      <p className="admin-help">
        Logging a correction publishes it straight to the public corrections page.
        Nothing is quietly edited.
      </p>

      <section className="uploader">
        <h3>Log a correction</h3>
        <CorrectionForm />
      </section>

      <section className="uploader">
        <h3>Published corrections</h3>
        {(corrections ?? []).length === 0 ? (
          <p className="admin-help">Nothing has needed correcting yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Page</th>
                <th scope="col">What changed</th>
              </tr>
            </thead>
            <tbody>
              {(corrections ?? []).map((correction) => (
                <tr key={correction.id}>
                  <td>{formatDay(correction.correction_date)}</td>
                  <td>{correction.page_path}</td>
                  <th scope="row">{correction.what_changed}</th>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
