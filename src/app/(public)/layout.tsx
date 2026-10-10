import Script from "next/script";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { VisitTracker } from "@/components/visit-tracker";
import { JsonLd } from "@/components/json-ld";
import { getSiteSettings } from "@/lib/queries/settings";
import { env } from "@/lib/env";
import { graph, organizationLd, websiteLd } from "@/lib/seo";

/**
 * The public site: sticky nav, content, footer.
 *
 * The admin panel is a sibling group with its own shell, so the workspace does
 * not carry the public navigation or the 501(c)(3) footer.
 */
export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();

  return (
    <>
      {/* Plausible: no cookies, no personal data, nothing to consent to, and
          nothing that follows a reader anywhere else. Public pages only, since
          the workspace is nobody's business but the organization's. */}
      <Script
        defer
        data-domain="monakproject.org"
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
      {/* First party visit and time on page measurement, read at /admin/traffic. */}
      <VisitTracker />
      {/* Who publishes this site, for search engines. On every public page. */}
      <JsonLd data={graph(organizationLd(env.siteUrl, settings), websiteLd(env.siteUrl))} />
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter ein={settings.org_ein} mailingAddress={settings.mailing_address} />
    </>
  );
}
