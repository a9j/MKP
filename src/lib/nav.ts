/** Navigation from mona-k-project-site-copy.md, Global section. */
export type NavLink = { href: string; label: string };
export type NavGroup = { label: string; links: readonly NavLink[] };
export type NavItem = NavLink | NavGroup;

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Data",
    links: [
      { href: "/explorer", label: "Explorer" },
      { href: "/records", label: "Records" },
      { href: "/votes", label: "Votes" },
      { href: "/budget", label: "Receipts" },
    ],
  },
  { href: "/reports", label: "Reports" },
  { href: "/reports#explainers", label: "Explainers" },
  { href: "/about", label: "About" },
  { href: "/get-involved", label: "Get Involved" },
];

export function isNavGroup(item: NavItem): item is NavGroup {
  return "links" in item;
}

export const SUPPORT_CTA = "Donate";
export const SUPPORT_HREF = "/get-involved";

/** Repeated verbatim in the hero and the footer. */
export const NEUTRALITY_LINE =
  "We do not take positions, endorse candidates, or recommend how to vote.";
