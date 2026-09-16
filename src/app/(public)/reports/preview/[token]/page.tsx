import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportBody } from "@/components/public/report-body";
import { getReportByPreviewToken } from "@/lib/queries/reports";

// Never cached and never indexed. A draft should not sit in a CDN or turn up
// in a search result while the council is still reading it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report preview",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReportPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getReportByPreviewToken(token);
  if (!report) notFound();

  return (
    <>
      <div className="preview-banner" role="status">
        <strong>
          {report.status === "published" ? "Published" : "Draft"} preview for the advisory
          council
        </strong>
        <span>
          This link is unlisted and is not indexed.
          {report.status === "draft"
            ? " This report is not on the public site yet."
            : " This report is already published."}
        </span>
      </div>

      <header className="wrap page-head">
        <h1>{report.title}</h1>
      </header>

      <section className="wrap vote-section report-page">
        <ReportBody report={report} />
      </section>
    </>
  );
}
