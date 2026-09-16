import Script from "next/script";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { getSiteSettings } from "@/lib/queries/settings";

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
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter ein={settings.org_ein} mailingAddress={settings.mailing_address} />
    </>
  );
}
