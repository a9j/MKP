import type { Metadata } from "next";
import Link from "next/link";
import { InquiryForm } from "@/components/public/inquiry-form";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about a report, a records request, or a vote summary? Found an error? Write to The Mona K Project.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <header className="wrap page-head">
        <h1>Write to us.</h1>
        <p className="lede">
          Questions about a report, a records request, or a vote summary? Found an
          error? Want a briefing? Write to{" "}
          <a href="mailto:hello@monakproject.org">hello@monakproject.org</a> or use the
          form.
        </p>
      </header>

      <section className="wrap vote-section contact-grid">
        <div>
          <InquiryForm
            kind="contact"
            idPrefix="contact"
            submitLabel="Send"
            audiences={["Teacher", "Parent", "Journalist", "Board or district staff", "Other"]}
          />
        </div>

        <aside>
          <h2 className="aside-head">Corrections</h2>
          <p className="sub">
            If we got a number wrong, tell us. We correct in public and note what
            changed. Every correction is listed on the{" "}
            <Link href="/corrections">corrections page</Link>.
          </p>

          <h2 className="aside-head">The Mona K Project</h2>
          <p className="sub">
            {settings.mailing_address ?? "[Mailing address]"}
            <br />
            Toledo, Ohio
          </p>
        </aside>
      </section>
    </>
  );
}
