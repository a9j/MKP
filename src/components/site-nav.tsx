"use client";

import Link from "next/link";
import { useState } from "react";
import { NAV_LINKS, SUPPORT_CTA } from "@/lib/nav";

/**
 * The mockup hides the nav links below 820px and offers nothing in their
 * place, which leaves the site unnavigable on a phone. The links move into a
 * disclosure instead, with 44px targets.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="site-nav">
      <div className="wrap">
        <div className="nav">
          <Link className="brand" href="/" onClick={() => setOpen(false)}>
            <span className="mark" aria-hidden="true" />
            The Mona K Project
          </Link>

          <div className="links">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link className="btn nav-support" href="/get-involved">
              {SUPPORT_CTA}
            </Link>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={open}
              aria-controls="mobile-links"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                {open ? (
                  <path
                    d="M4 4l10 10M14 4L4 14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M2 5h14M2 9h14M2 13h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="mobile-links" id="mobile-links" data-open={open}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link className="btn" href="/get-involved" onClick={() => setOpen(false)}>
            {SUPPORT_CTA}
          </Link>
        </div>
      </div>
    </nav>
  );
}
