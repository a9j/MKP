import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { env } from "@/lib/env";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Through env.siteUrl, not process.env: the guard there is what keeps an
  // empty variable from failing the build with an unattributable "Invalid URL".
  metadataBase: new URL(env.siteUrl),
  title: {
    default: "The Mona K Project. Toledo's public records, explained.",
    template: "%s. The Mona K Project",
  },
  description:
    "The Mona K Project reads Toledo's school budgets, salary schedules, board votes, and city finances and explains them in plain language. Every number sourced. No positions.",
  applicationName: "The Mona K Project",
  authors: [{ name: "The Mona K Project", url: "/about" }],
  publisher: "The Mona K Project",
  category: "Civic information",
  // Phone numbers and addresses in budget tables are figures, not links.
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: "The Mona K Project",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  verification: {
    ...(env.googleSiteVerification ? { google: env.googleSiteVerification } : {}),
    ...(env.bingSiteVerification
      ? { other: { "msvalidate.01": env.bingSiteVerification } }
      : {}),
  },
};

/**
 * Document shell only. The public site and the admin panel each bring their
 * own chrome, so neither inherits the other's.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={instrumentSans.variable} data-theme="light">
      <body>{children}</body>
    </html>
  );
}
