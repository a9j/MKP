import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ReportForm } from "@/components/admin/report-form";
import { formatDay } from "@/lib/queries/records";
import { REPORT_TYPE_LABEL, type ReportType } from "@/lib/report-types";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Reports</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, slug, title, type, report_date, status")
    .order("report_date", { ascending: false });

  return (
    <>
      <h1>Reports</h1>
      <p className="admin-help">
        A draft stays off the public site and gets an unlisted link the advisory
        council can read without an account.
      </p>

      <section className="uploader">
        <h3>New report</h3>
        <ReportForm siteUrl={env.siteUrl} />
      </section>

      <section className="uploader">
        <h3>All reports</h3>
        {(reports ?? []).length === 0 ? (
          <p className="admin-help">Nothing yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Edit</th>
              </tr>
            </thead>
            <tbody>
              {(reports ?? []).map((report) => (
                <tr key={report.id}>
                  <td>{formatDay(report.report_date)}</td>
                  <th scope="row">{report.title}</th>
                  <td>{REPORT_TYPE_LABEL[report.type as ReportType]}</td>
                  <td>{report.status === "published" ? "Published" : "Draft"}</td>
                  <td>
                    <Link href={`/admin/reports/${report.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
