"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { NAV_ITEMS, SUPPORT_CTA, SUPPORT_HREF, isNavGroup, type NavGroup } from "@/lib/nav";

/**
 * The full row of links needs about 1280px once the logo and the button sit
 * beside it, so below that the links move into a drawer. The drawer is a
 * Radix dialog: it traps focus, closes on Escape, and hands focus back to
 * the menu button.
 */
export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // A link inside the drawer navigates without unmounting the nav.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <nav className="site-nav" aria-label="Main">
      <div className="wrap">
        <div className="nav">
          <Link className="brand" href="/">
            <span className="mark" aria-hidden="true" />
            The Mona K Project
          </Link>

          <ul className="links">
            {NAV_ITEMS.map((item) =>
              isNavGroup(item) ? (
                <li key={item.label}>
                  <NavDropdown group={item} pathname={pathname} />
                </li>
              ) : (
                <li key={item.href}>
                  <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>

          <div className="nav-actions">
            <Link className="btn nav-support" href={SUPPORT_HREF}>
              {SUPPORT_CTA}
            </Link>

            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger asChild>
                <button
                  type="button"
                  className="nav-toggle"
                  aria-expanded={open}
                  aria-label="Open menu"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                    <path
                      d="M2 5h14M2 9h14M2 13h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="nav-drawer-overlay" />
                <Dialog.Content className="nav-drawer" aria-describedby={undefined}>
                  <div className="nav-drawer-head">
                    <Dialog.Title className="nav-drawer-title">Menu</Dialog.Title>
                    <Dialog.Close asChild>
                      <button type="button" className="nav-toggle" aria-label="Close menu">
                        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                          <path
                            d="M4 4l10 10M14 4L4 14"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </Dialog.Close>
                  </div>

                  <ul className="nav-drawer-links">
                    {NAV_ITEMS.map((item) =>
                      isNavGroup(item) ? (
                        <li key={item.label}>
                          <span className="nav-drawer-group">{item.label}</span>
                          <ul>
                            {item.links.map((link) => (
                              <li key={link.href}>
                                <DrawerLink href={link.href} label={link.label} pathname={pathname} />
                              </li>
                            ))}
                          </ul>
                        </li>
                      ) : (
                        <li key={item.href}>
                          <DrawerLink href={item.href} label={item.label} pathname={pathname} />
                        </li>
                      ),
                    )}
                  </ul>

                  <Dialog.Close asChild>
                    <Link className="btn nav-drawer-support" href={SUPPORT_HREF}>
                      {SUPPORT_CTA}
                    </Link>
                  </Dialog.Close>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </div>
    </nav>
  );
}

/** Closes the drawer on click, which also covers a hash link that keeps the pathname. */
function DrawerLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  return (
    <Dialog.Close asChild>
      <Link href={href} aria-current={pathname === href ? "page" : undefined}>
        {label}
      </Link>
    </Dialog.Close>
  );
}

/**
 * A disclosure, not an ARIA menu: the items are ordinary links, so Tab moves
 * through them. Escape or a click outside closes it.
 */
function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const active = group.links.some((link) => link.href === pathname);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className="nav-dropdown"
      ref={root}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        className="nav-dropdown-button"
        aria-expanded={open}
        aria-controls={menuId}
        data-active={active || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {group.label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M2 3.5l3 3 3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <ul className="nav-dropdown-menu" id={menuId} hidden={!open}>
        {group.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
