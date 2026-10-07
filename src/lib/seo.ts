/**
 * Structured data (schema.org JSON-LD) for search engines.
 *
 * This is what lets Google show the organization panel, list the Explorer and
 * the budget in Dataset Search, show breadcrumbs instead of a bare URL, and
 * date and attribute each report. Every builder takes the site origin so the
 * same code works on a preview deployment and in production.
 */
import type { Metadata } from "next";
import type { Report } from "@/lib/report-types";

export const SITE_NAME = "The Mona K Project";
export const ORG_DESCRIPTION =
  "A Toledo, Ohio nonprofit that reads public records, including school budgets, salary schedules, board votes, levies and city finances, and explains them in plain language with every number linked to its source. Nonpartisan: no positions, no endorsements.";

type Json = Record<string, unknown>;

export const orgId = (origin: string) => `${origin}/#organization`;
export const siteId = (origin: string) => `${origin}/#website`;

export function organizationLd(
  origin: string,
  settings: { org_ein?: string; mailing_address?: string; contact_email?: string },
): Json {
  return {
    "@type": "NGO",
    "@id": orgId(origin),
    name: SITE_NAME,
    alternateName: ["Mona K Project", "MKP"],
    url: `${origin}/`,
    logo: {
      "@type": "ImageObject",
      url: `${origin}/apple-icon.png`,
      width: 180,
      height: 180,
    },
    description: ORG_DESCRIPTION,
    nonprofitStatus: "Nonprofit501c3",
    areaServed: [
      { "@type": "City", name: "Toledo, Ohio" },
      { "@type": "AdministrativeArea", name: "Lucas County, Ohio" },
    ],
    knowsAbout: [
      "Toledo Public Schools teacher salaries",
      "Toledo Public Schools budget",
      "City of Toledo budget",
      "Ohio public records",
      "Toledo school board votes",
      "Toledo levies and ballot issues",
    ],
    ...(settings.org_ein ? { taxID: settings.org_ein } : {}),
    ...(settings.contact_email ? { email: settings.contact_email } : {}),
    ...(settings.mailing_address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: settings.mailing_address,
            addressLocality: "Toledo",
            addressRegion: "OH",
            addressCountry: "US",
          },
        }
      : {}),
  };
}

export function websiteLd(origin: string): Json {
  return {
    "@type": "WebSite",
    "@id": siteId(origin),
    name: SITE_NAME,
    url: `${origin}/`,
    description: "Toledo's public records, explained in plain language.",
    inLanguage: "en-US",
    publisher: { "@id": orgId(origin) },
  };
}

export function breadcrumbLd(origin: string, trail: { name: string; path: string }[]): Json {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${origin}${item.path === "/" ? "/" : item.path}`,
    })),
  };
}

export function datasetLd(
  origin: string,
  d: {
    path: string;
    name: string;
    description: string;
    keywords: string[];
    sources: { name: string; url: string }[];
    temporalCoverage?: string;
  },
): Json {
  return {
    "@type": "Dataset",
    name: d.name,
    description: d.description,
    url: `${origin}${d.path}`,
    keywords: d.keywords,
    isAccessibleForFree: true,
    inLanguage: "en-US",
    spatialCoverage: {
      "@type": "Place",
      name: "Toledo, Ohio",
      geo: { "@type": "GeoCoordinates", latitude: 41.6528, longitude: -83.5379 },
    },
    ...(d.temporalCoverage ? { temporalCoverage: d.temporalCoverage } : {}),
    creator: { "@id": orgId(origin) },
    publisher: { "@id": orgId(origin) },
    isBasedOn: d.sources.map((s) => ({ "@type": "CreativeWork", name: s.name, url: s.url })),
  };
}

/** Plain text from a markdown summary, cut at a word boundary. */
export function plainText(markdown: string, max = 160): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+>]\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export function reportLd(origin: string, report: Report): Json {
  const url = `${origin}/reports/${report.slug}`;
  return {
    "@type": "Report",
    "@id": `${url}#report`,
    headline: report.title.slice(0, 110),
    name: report.title,
    description: plainText(report.summary, 300),
    url,
    mainEntityOfPage: url,
    datePublished: report.reportDate,
    dateModified: report.reportDate,
    inLanguage: "en-US",
    genre: report.typeLabel,
    isAccessibleForFree: true,
    author: { "@id": orgId(origin) },
    publisher: { "@id": orgId(origin) },
    about: { "@type": "City", name: "Toledo, Ohio" },
    citation: report.sources.map((s) => ({ "@type": "CreativeWork", name: s.label, url: s.url })),
  };
}

/** One script tag's worth: several nodes under a single @context. */
export function graph(...nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/**
 * Metadata for one public page: title, description, its canonical address,
 * and the share card text. The canonical tells Google which URL is the real
 * one, so a link with ?utm_source=... or the www. host never splits a page's
 * ranking in two.
 */
export function pageMetadata(p: {
  title?: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const shareTitle = p.title ? `${p.title}. ${SITE_NAME}` : `${SITE_NAME}. Toledo's public records, explained.`;
  return {
    ...(p.title ? { title: p.title } : {}),
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: {
      type: p.type ?? "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: p.path,
      title: shareTitle,
      description: p.description,
    },
    twitter: { card: "summary_large_image", title: shareTitle, description: p.description },
  };
}
