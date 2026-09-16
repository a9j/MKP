import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { RecordsForm } from "@/components/admin/records-form";
import { formatDay, STATUS_LABEL, type RequestStatus } from "@/lib/queries/records";

export const dynamic = "force-dynamic";

export default async function AdminRecordsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Records requests</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const [{ data: agencies }, { data: requests }] = await Promise.all([
    supabase.from("agencies").select("id, name").order("name"),
    supabase
      .from("records_request_log")
      .select("id, date_filed, agency_name, request_text, status, response_business_days, open_business_days, document_count")
      .order("date_filed", { ascending: false })
      .limit(25),
  ]);

  return (
    <>
      <h1>Records requests</h1>
      <p className="admin-help">
        Saving publishes straight away. The request log is the public record of what
        we asked for and what came back, so there is no draft state.
      </p>

      <section className="uploader">
        <RecordsForm agencies={agencies ?? []} />
      </section>

      <section className="uploader">
        <h3>Recently filed</h3>
        {(requests ?? []).length === 0 ? (
          <p className="admin-help">Nothing filed yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Filed</th>
                <th scope="col">Agency</th>
                <th scope="col">Request</th>
                <th scope="col">Status</th>
                <th scope="col">Response</th>
                <th scope="col" className="num">Docs</th>
              </tr>
            </thead>
            <tbody>
              {(requests ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.date_filed ? formatDay(row.date_filed) : ""}</td>
                  <td>{row.agency_name}</td>
                  <th scope="row">{row.request_text}</th>
                  <td>{STATUS_LABEL[row.status as RequestStatus]}</td>
                  <td>
                    {row.response_business_days !== null
                      ? `${row.response_business_days} business days`
                      : `Open ${row.open_business_days ?? 0} business days`}
                  </td>
                  <td className="num">{row.document_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
