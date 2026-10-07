import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getPublishedReports } from "@/lib/queries/reports";

/** Every public page, plus one entry per published report. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = [
    { path: "/", priority: 1 },
    { path: "/explorer", priority: 0.9 },
    { path: "/budget", priority: 0.9 },
    { path: "/reports", priority: 0.9 },
    { path: "/records", priority: 0.8 },
    { path: "/votes", priority: 0.8 },
    { path: "/votes/members", priority: 0.6 },
    { path: "/listening", priority: 0.6 },
    { path: "/about", priority: 0.6 },
    { path: "/get-involved", priority: 0.6 },
    { path: "/contact", priority: 0.5 },
    { path: "/corrections", priority: 0.5 },
  ].map((page) => ({
    url: `${env.siteUrl}${page.path}`,
    // No lastModified on these. A date that changes on every build tells
    // Google every page changed, and it learns to ignore the field. Reports
    // carry their real date below.
    changeFrequency: "weekly" as const,
    priority: page.priority,
  }));

  const reports = (await getPublishedReports()).map((report) => ({
    url: `${env.siteUrl}/reports/${report.slug}`,
    lastModified: new Date(report.reportDate),
    changeFrequency: "yearly" as const,
    priority: 0.7,
  }));

  return [...pages, ...reports];
}
