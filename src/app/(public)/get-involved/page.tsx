import type { Metadata } from "next";
import { InquiryForm } from "@/components/public/inquiry-form";
import { SubscribeForm } from "@/components/public/subscribe-form";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Get Involved",
  description:
    "Donate, join the advisory council, or volunteer to help Toledo read its own records.",
};

export default async function GetInvolvedPage() {
  const settings = await getSiteSettings();
  const amounts = (settings.donate_amounts ?? "25,50,100").split(",").map((a) => a.trim());

  return (
    <>
      <header className="wrap page-head">
        <h1>Help Toledo read its own records.</h1>
      </header>

      <section className="wrap vote-section">
        <div className="features">
          <div className="feature">
            <h3>Donate</h3>
            <p>
              The Mona K Project runs on small donations. Records requests, review time,
              and publishing are all we spend on.
            </p>
            <p className="report-actions">
              {settings.donate_url ? (
                <>
                  {amounts.map((amount) => (
                    <a
                      key={amount}
                      className="btn ghost"
                      href={`${settings.donate_url}?amount=${amount}`}
                    >
                      ${amount}
                    </a>
                  ))}
                  <a className="btn" href={settings.donate_url}>
                    Donate
                  </a>
                </>
              ) : (
                <span className="unavailable">
                  The donation page has not been set up yet.
                </span>
              )}
            </p>
          </div>

          <div className="feature">
            <h3>Join the advisory council</h3>
            <p>
              Council members review each report before it goes out. We are looking for
              current and retired teachers, parents, accountants, and anyone who has read
              a school budget and wanted to throw it across the room. Two to three hours a
              quarter.
            </p>
            <InquiryForm
              kind="council"
              idPrefix="council"
              submitLabel="Apply"
              messageLabel="Why you would like to join, and what you would bring"
            />
          </div>

          <div className="feature">
            <h3>Volunteer</h3>
            <p>
              We need people to read documents, check sources, and attend board meetings.
              No experience required, just patience with PDFs.
            </p>
            <InquiryForm
              kind="volunteer"
              idPrefix="volunteer"
              submitLabel="Tell us how you can help"
              messageLabel="How you can help"
            />
          </div>

          <div className="feature">
            <h3>For organizations</h3>
            <p>
              Unions, boards, newsrooms, and community groups can request a briefing on
              any report. We present the numbers and take questions. We do not advise on
              strategy.
            </p>
            <InquiryForm
              kind="briefing"
              idPrefix="briefing"
              submitLabel="Request a briefing"
              messageLabel="Which report, and who would be in the room"
            />
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Stay updated</h2>
          <p className="sub">
            One email when we publish. That is the only time you will hear from us.
          </p>
          <SubscribeForm />
        </div>
      </section>
    </>
  );
}
