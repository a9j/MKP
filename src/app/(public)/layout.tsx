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
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter ein={settings.org_ein} mailingAddress={settings.mailing_address} />
    </>
  );
}
