import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportBody } from "@/components/public/report-body";
import { getPublishedReport, getPublishedReports } from "@/lib/queries/reports";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getPublishedReports()).map((report) => ({ slug: report.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = await getPublishedReport(slug);
  if (!report) return { title: "Report not found" };

  return {
    title: report.title,
    description: report.summary.replace(/[#*_`>\-]/g, "").slice(0, 160),
  };
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await getPublishedReport(slug);
  if (!report) notFound();

  return (
    <>
      <header className="wrap page-head">
        <h1>{report.title}</h1>
      </header>

      <section className="wrap vote-section report-page">
        <ReportBody report={report} />
        <p className="note">
          <Link href="/reports">All reports</Link>
        </p>
      </section>
    </>
  );
}
