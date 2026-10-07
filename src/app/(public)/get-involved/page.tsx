import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { env } from "@/lib/env";
import { breadcrumbLd, graph, pageMetadata } from "@/lib/seo";
import { Photo } from "@/components/photo";
import { InquiryForm } from "@/components/public/inquiry-form";
import { SubscribeForm } from "@/components/public/subscribe-form";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Get Involved: Donate, Volunteer, Join the Council",
  description:
    "Donate, join the advisory council, or volunteer to help Toledo read its own public records.",
  path: "/get-involved",
});

export default async function GetInvolvedPage() {
  const settings = await getSiteSettings();
  const amounts = (settings.donate_amounts ?? "25,50,100").split(",").map((a) => a.trim());

  return (
    <>
      <JsonLd data={graph(breadcrumbLd(env.siteUrl, [{ name: "Get Involved", path: "/get-involved" }]))} />
      <header className="civic-page-hero">
        <div className="wrap civic-page-hero-inner">
          <p className="civic-kicker">Get involved</p>
          <h1>Help Toledo read its own records.</h1>
          <p className="lede">
            Four ways in. Pick the one that fits.
          </p>
        </div>
      </header>
      <Photo
        file="for-residents.jpg"
        alt="Toledo residents in their neighborhood"
        ratio="21 / 8"
        sizes="100vw"
        className="civic-photo-band"
        priority
      />

      <section className="wrap civic-section">
        <div className="civic-cards">
          <div className="civic-card tone-gold">
            <div className="tag">Give</div>
            <h3>Donate</h3>
            <p>
              The Mona K Project runs on small donations. Records requests, review time,
              and publishing are all we spend on.
            </p>
            <div className="civic-card-foot">
              {settings.donate_url ? (
                <>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                    {amounts.map((amount) => (
                      <a
                        key={amount}
                        className="btn btn-outline-navy"
                        href={`${settings.donate_url}?amount=${amount}`}
                      >
                        ${amount}
                      </a>
                    ))}
                  </div>
                  <a className="btn btn-gold" style={{ background: "#0F2A44", color: "#fff", borderColor: "#0F2A44" }} href={settings.donate_url}>
                    Donate
                  </a>
                </>
              ) : (
                <span className="unavailable">
                  The donation page has not been set up yet.
                </span>
              )}
            </div>
          </div>

          <div className="civic-card tone-navy">
            <div className="tag">Review</div>
            <h3>Join the advisory council</h3>
            <p>
              Council members review each report before it goes out. We are looking for
              current and retired teachers, parents, accountants, and anyone who has read
              a school budget and wanted to throw it across the room. Two to three hours a
              quarter.
            </p>
            <div className="civic-card-foot">
              <InquiryForm
                kind="council"
                idPrefix="council"
                submitLabel="Apply"
                messageLabel="Why you would like to join, and what you would bring"
              />
            </div>
          </div>

          <div className="civic-card tone-teal">
            <div className="tag">Help</div>
            <h3>Volunteer</h3>
            <p>
              We need people to read documents, check sources, and attend board meetings.
              No experience required, just patience with PDFs.
            </p>
            <div className="civic-card-foot">
              <InquiryForm
                kind="volunteer"
                idPrefix="volunteer"
                submitLabel="Tell us how you can help"
                messageLabel="How you can help"
              />
            </div>
          </div>

          <div className="civic-card">
            <div className="tag">Brief us in</div>
            <h3>For organizations</h3>
            <p>
              Unions, boards, newsrooms, and community groups can request a briefing on
              any report. We present the numbers and take questions. We do not advise on
              strategy.
            </p>
            <div className="civic-card-foot">
              <InquiryForm
                kind="briefing"
                idPrefix="briefing"
                submitLabel="Request a briefing"
                messageLabel="Which report, and who would be in the room"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="civic-band civic-band-navy">
        <div className="wrap">
          <p className="civic-kicker">Stay updated</p>
          <h2>One email when we publish.</h2>
          <p className="sub">
            That is the only time you will hear from us.
          </p>
          <SubscribeForm />
        </div>
      </section>
    </>
  );
}
