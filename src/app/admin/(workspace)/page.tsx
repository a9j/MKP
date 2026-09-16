import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { OVERDUE_BUSINESS_DAYS } from "@/lib/limits";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Dashboard</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();

  const [reports, listening, votes, records, open, overdue] = await Promise.all([
    supabase.from("reports").select("id, status", { count: "exact", head: false }),
    supabase.from("listening_sessions").select("id, status"),
    supabase.from("votes").select("id", { count: "exact", head: true }),
    supabase.from("records_requests").select("id", { count: "exact", head: true }),
    supabase
      .from("records_requests")
      .select("id", { count: "exact", head: true })
      .is("date_responded", null),
    supabase
      .from("records_request_log")
      .select("id, agency_name, request_text, date_filed, open_business_days")
      .gt("open_business_days", OVERDUE_BUSINESS_DAYS)
      .order("open_business_days", { ascending: false }),
  ]);

  const reportRows = reports.data ?? [];
  const listeningRows = listening.data ?? [];
  const published =
    reportRows.filter((r) => r.status === "published").length +
    listeningRows.filter((r) => r.status === "published").length +
    (votes.count ?? 0) +
    (records.count ?? 0);
  const drafts =
    reportRows.filter((r) => r.status === "draft").length +
    listeningRows.filter((r) => r.status === "draft").length;
  const overdueRows = overdue.data ?? [];

  return (
    <>
      <h1>Dashboard</h1>

      {/* First thing on the screen: posting a vote is the most time sensitive
          task, and it is the one most often done from a phone after a meeting. */}
      <div className="admin-actions shortcut">
        <Link className="btn" href="/admin/votes">
          Post a vote
        </Link>
        <Link className="btn ghost" href="/admin/records">
          Log a records request
        </Link>
      </div>

      <dl className="diff">
        <div>
          <dt>Published items</dt>
          <dd>{published}</dd>
        </div>
        <div>
          <dt>Drafts awaiting review</dt>
          <dd>{drafts}</dd>
        </div>
        <div>
          <dt>Open requests</dt>
          <dd>{open.count ?? 0}</dd>
        </div>
        <div>
          <dt>Past {OVERDUE_BUSINESS_DAYS} business days</dt>
          <dd>{overdueRows.length}</dd>
        </div>
      </dl>

      <section className="uploader">
        <h3>Records requests with no response</h3>
        {overdueRows.length === 0 ? (
          <p className="admin-help">
            Nothing is past {OVERDUE_BUSINESS_DAYS} business days.
          </p>
        ) : (
          <table className="data-table">
            <caption>
              Open longer than {OVERDUE_BUSINESS_DAYS} business days. Worth a follow up.
            </caption>
            <thead>
              <tr>
                <th scope="col">Agency</th>
                <th scope="col">Request</th>
                <th scope="col" className="num">Business days open</th>
              </tr>
            </thead>
            <tbody>
              {overdueRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.agency_name}</td>
                  <th scope="row">{row.request_text}</th>
                  <td className="num">{row.open_business_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
