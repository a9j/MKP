import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-instrument-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "The Mona K Project. Toledo's public records, explained.",
    template: "%s. The Mona K Project",
  },
  description:
    "The Mona K Project reads Toledo's school budgets, salary schedules, board votes, and city finances and explains them in plain language. Every number sourced. No positions.",
};

/**
 * Document shell only. The public site and the admin panel each bring their
 * own chrome, so neither inherits the other's.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body>{children}</body>
    </html>
  );
}
