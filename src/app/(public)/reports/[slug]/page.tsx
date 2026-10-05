import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportBody } from "@/components/public/report-body";
import { getPublishedReport, getPublishedReports } from "@/lib/queries/reports";
import { getPublishedLevySlugs } from "@/lib/queries/explainers";
import { levyPageForReport } from "@/lib/levy-pairs";

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
  const [report, levySlugs] = await Promise.all([
    getPublishedReport(slug),
    getPublishedLevySlugs(),
  ]);
  if (!report) notFound();

  // Only when the companion page is actually published, so the link can never
  // point at a draft or at nothing.
  const pairedLevySlug = levyPageForReport(report.slug);
  const levyHref = pairedLevySlug && levySlugs.has(pairedLevySlug) ? `/levy/${pairedLevySlug}` : null;

  return (
    <>
      <header className="wrap page-head">
        <h1>{report.title}</h1>
      </header>

      <section className="wrap vote-section report-page">
        <ReportBody report={report} />
        {levyHref ? (
          <p className="note companion-link">
            <Link href={levyHref}>Work out what this levy would cost your own home</Link>
          </p>
        ) : null}
        <p className="note">
          <Link href="/reports">All reports</Link>
        </p>
      </section>
    </>
  );
}
