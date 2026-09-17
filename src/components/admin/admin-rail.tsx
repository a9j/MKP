"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Left rail on desktop, bottom tab bar on a phone. */
const LINKS = [
  { href: "/admin", label: "Dashboard", short: "Home" },
  { href: "/admin/votes", label: "Votes", short: "Votes" },
  { href: "/admin/meetings", label: "Meetings", short: "Meets" },
  { href: "/admin/records", label: "Records", short: "Records" },
  { href: "/admin/reports", label: "Reports", short: "Reports" },
  { href: "/admin/listening", label: "Listening", short: "Listen" },
  { href: "/admin/explorer", label: "Explorer data", short: "Data" },
  { href: "/admin/people", label: "People", short: "People" },
  { href: "/admin/corrections", label: "Corrections", short: "Fixes" },
  { href: "/admin/subscribers", label: "Subscribers", short: "Subs" },
  { href: "/admin/settings", label: "Settings", short: "Settings" },
];

export function AdminRail() {
  const pathname = usePathname();

  return (
    <nav className="admin-rail" aria-label="Admin sections">
      <Link className="brand admin-brand" href="/admin">
        <span className="mark" aria-hidden="true" />
        <span className="admin-brand-text">The Mona K Project</span>
      </Link>
      <ul>
        {LINKS.map((link) => {
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link href={link.href} aria-current={active ? "page" : undefined}>
                <span className="rail-long">{link.label}</span>
                <span className="rail-short">{link.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <form className="rail-signout" action="/admin/signout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </nav>
  );
}
