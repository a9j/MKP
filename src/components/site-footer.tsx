import Link from "next/link";
import { NEUTRALITY_LINE } from "@/lib/nav";

type SiteFooterProps = {
  /** From site_settings. Empty until it is filled in from the admin panel. */
  ein?: string;
  mailingAddress?: string;
};

/** Footer copy is from mona-k-project-site-copy.md, Global section. */
export function SiteFooter({ ein, mailingAddress }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot">
          <div>
            <Link className="brand" href="/">
              <span className="mark" aria-hidden="true" />
              The Mona K Project
            </Link>
            <p style={{ marginTop: 14 }}>
              The Mona K Project makes Toledo&rsquo;s public data understandable so
              residents can push for better decisions.
            </p>
          </div>

          <div className="col">
            <Link href="/explorer">Explorer</Link>
            <Link href="/reports">Reports</Link>
            <Link href="/records">Records Desk</Link>
            <Link href="/votes">Vote Watch</Link>
          </div>

          <div className="col">
            <Link href="/about">About</Link>
            <Link href="/get-involved">Get involved</Link>
            <Link href="/contact">Contact</Link>
            <a href="mailto:hello@monakproject.org">hello@monakproject.org</a>
          </div>
        </div>

        <div className="fine">
          <span>
            The Mona K Project is a 501(c)(3) nonprofit. EIN{" "}
            {ein && ein.length > 0 ? ein : "[XX-XXXXXXX]"}.
            {mailingAddress && mailingAddress.length > 0
              ? ` ${mailingAddress}`
              : " [Mailing address]"}
          </span>
          <span>{NEUTRALITY_LINE}</span>
        </div>
      </div>
    </footer>
  );
}
