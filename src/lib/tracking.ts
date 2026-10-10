/**
 * Pure helpers for the visitor tracker. No server or browser APIs here, so the
 * route, the admin page and the tests can all import it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** Six hours. Matches the check constraint on page_views.engaged_seconds. */
export const MAX_ENGAGED_SECONDS = 21600;

/**
 * Crawlers, link unfurlers, uptime checks and headless browsers. They are not
 * readers, and counting them would make every number on the traffic page wrong.
 */
const BOT =
  /bot|crawl|spider|slurp|scrape|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|vercel|curl|wget|python|httpclient|axios|node-fetch|go-http|java\//i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  return BOT.test(userAgent);
}

export type Device = "mobile" | "tablet" | "desktop";

export function deviceFrom(userAgent: string | null | undefined, width?: number | null): Device {
  const ua = userAgent ?? "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return "tablet";
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return "mobile";
  if (typeof width === "number" && width > 0 && width < 768) return "mobile";
  return "desktop";
}

/**
 * The host of an external referrer, or null for a direct visit or a click from
 * our own pages. Only the host is kept: a full referring URL can carry what
 * someone typed into a search box.
 */
export function referrerHost(referrer: unknown, ownHost: string): string | null {
  if (typeof referrer !== "string" || referrer.length === 0) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const own = ownHost.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
    if (!host || host === own) return null;
    return host.slice(0, 255);
  } catch {
    return null;
  }
}

/** A site path, or null if it is not one. Query strings are dropped. */
export function cleanPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  const bare = path.split(/[?#]/)[0];
  if (bare.length === 0 || bare.length > 512) return null;
  // The admin panel is not measured, and the API is not a page.
  if (bare.startsWith("/admin") || bare.startsWith("/api")) return null;
  return bare;
}

/** A campaign tag: short, plain, lower case. */
export function cleanTag(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const tag = value.trim().toLowerCase().slice(0, 100);
  return tag.length > 0 ? tag : null;
}

/** Vercel URL encodes the city header ("San%20Francisco"). */
export function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded.length > 0 ? decoded.slice(0, 100) : null;
  } catch {
    return null;
  }
}

/** A friendly name for where a visit came from. */
const SOURCE_NAMES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.com$/, "Yahoo"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$|^l\.facebook\.com$|^m\.facebook\.com$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X (Twitter)"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)threads\.net$/, "Threads"],
  [/(^|\.)bsky\.app$/, "Bluesky"],
  [/(^|\.)nextdoor\.com$/, "Nextdoor"],
  [/(^|\.)youtube\.com$/, "YouTube"],
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)claude\.ai$/, "Claude"],
];

export function sourceLabel(row: { utm_source: string | null; referrer_host: string | null }): string {
  if (row.utm_source) return row.utm_source;
  if (!row.referrer_host) return "Direct or unknown";
  for (const [pattern, name] of SOURCE_NAMES) {
    if (pattern.test(row.referrer_host)) return name;
  }
  return row.referrer_host;
}

/** "45s", "3m 07s", "1h 02m". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}
