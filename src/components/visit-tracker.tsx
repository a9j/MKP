"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Records each page a reader opens and how long it is actually on screen.
 *
 * No cookies and nothing stored beyond the tab: a visit id lives in
 * sessionStorage and ends when the tab closes. Time only counts while the page
 * is visible, so a tab left open in the background does not read as a
 * three hour visit. The server keeps no IP address (see /api/track).
 */

const ENDPOINT = "/api/track";
const HEARTBEAT_MS = 15_000;
const VISIT_KEY = "mkp_visit";

/** The referrer only means something for the first page of a visit. */
let firstView = true;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Older browsers: a v4 shaped id from Math.random is fine for grouping views.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function visitId(): string {
  try {
    let id = sessionStorage.getItem(VISIT_KEY);
    if (!id) {
      id = newId();
      sessionStorage.setItem(VISIT_KEY, id);
    }
    return id;
  } catch {
    return newId();
  }
}

function send(body: Record<string, unknown>, leaving: boolean) {
  const json = JSON.stringify(body);
  try {
    if (leaving && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ENDPOINT, new Blob([json], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      body: json,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Measuring must never break the page.
  }
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Automated browsers (tests, Lighthouse) are not readers.
    if (navigator.webdriver) return;
    if (!pathname || pathname.startsWith("/admin")) return;

    const id = newId();
    const params = new URLSearchParams(window.location.search);
    send(
      {
        e: "start",
        id,
        visit: visitId(),
        path: pathname,
        ref: firstView ? document.referrer : "",
        w: window.innerWidth,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign"),
      },
      false,
    );
    firstView = false;

    let engagedMs = 0;
    let visibleSince: number | null =
      document.visibilityState === "visible" ? performance.now() : null;
    let lastSent = 0;

    const seconds = () =>
      Math.round(
        (engagedMs + (visibleSince !== null ? performance.now() - visibleSince : 0)) / 1000,
      );

    const ping = (leaving: boolean) => {
      const s = seconds();
      if (s <= lastSent) return;
      lastSent = s;
      send({ e: "ping", id, s }, leaving);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) {
          engagedMs += performance.now() - visibleSince;
          visibleSince = null;
        }
        ping(true);
      } else if (visibleSince === null) {
        visibleSince = performance.now();
      }
    };
    const onPageHide = () => ping(true);

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") ping(false);
    }, HEARTBEAT_MS);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // Moving to another page on the site: close this one out.
      ping(true);
    };
  }, [pathname]);

  return null;
}
