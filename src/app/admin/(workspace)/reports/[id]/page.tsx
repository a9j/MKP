import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ReportForm } from "@/components/admin/report-form";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Edit report</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const { data: report } = await supabase
    .from("reports")
    .select("id, slug, title, type, report_date, summary, status, preview_token, report_sources(label, url, sort_order)")
    .eq("id", id)
    .maybeSingle();

  if (!report) notFound();

  const sources = [...(report.report_sources ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ label: s.label, url: s.url }));

  return (
    <>
      <h1>Edit report</h1>
      <p className="admin-help">
        <Link href="/admin/reports">Back to all reports</Link>
      </p>

      <section className="uploader">
        <ReportForm report={{ ...report, sources }} siteUrl={env.siteUrl} />
      </section>
    </>
  );
}
