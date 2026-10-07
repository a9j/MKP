/**
 * Turns page_views rows into the numbers on /admin/traffic.
 *
 * Pure, so it is tested without a database. The page fetches the rows for the
 * chosen window and hands them here.
 */
import { formatDuration, sourceLabel } from "@/lib/tracking";

export type PageViewRow = {
  id: string;
  visit_id: string;
  visitor_hash: string;
  path: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device: string;
  city: string | null;
  region: string | null;
  country: string | null;
  started_at: string;
  last_seen_at: string;
  engaged_seconds: number;
};

export type Ranked = { label: string; count: number; share: number };

export type PageStat = { path: string; views: number; visitors: number; avgSeconds: number };

export type VisitSummary = {
  visitId: string;
  startedAt: string;
  landingPage: string;
  pages: string[];
  seconds: number;
  source: string;
  place: string;
  device: string;
};

export type DayStat = { day: string; visitors: number; visits: number; views: number };

export type TrafficSummary = {
  visitors: number;
  visits: number;
  pageViews: number;
  avgVisitSeconds: number;
  avgPageSeconds: number;
  pagesPerVisit: number;
  /** Visits that left within ten seconds having seen one page. */
  quickExitShare: number;
  onlineNow: number;
  days: DayStat[];
  pages: PageStat[];
  sources: Ranked[];
  places: Ranked[];
  devices: Ranked[];
  campaigns: Ranked[];
  recentVisits: VisitSummary[];
};

const TIME_ZONE = "America/Detroit";

const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function rank(counts: Map<string, number>, total: number, limit: number): Ranked[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, share: total > 0 ? count / total : 0 }));
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function placeLabel(row: Pick<PageViewRow, "city" | "region" | "country">): string {
  if (row.city && row.region) return `${row.city}, ${row.region}`;
  if (row.city) return row.city;
  if (row.region && row.country) return `${row.region}, ${row.country}`;
  return row.country ?? "Unknown";
}

export function summarize(rows: PageViewRow[], now: Date = new Date()): TrafficSummary {
  // Oldest first, so a visit's first row is its landing page.
  const sorted = [...rows].sort((a, b) => a.started_at.localeCompare(b.started_at));

  const visits = new Map<string, PageViewRow[]>();
  for (const row of sorted) {
    const list = visits.get(row.visit_id);
    if (list) list.push(row);
    else visits.set(row.visit_id, [row]);
  }

  const visitorHashes = new Set(sorted.map((r) => r.visitor_hash));
  const totalSeconds = sorted.reduce((sum, r) => sum + r.engaged_seconds, 0);

  // Per page.
  const pageViews = new Map<string, number>();
  const pageVisitors = new Map<string, Set<string>>();
  const pageSeconds = new Map<string, number>();
  for (const row of sorted) {
    bump(pageViews, row.path);
    bump(pageSeconds, row.path, row.engaged_seconds);
    const set = pageVisitors.get(row.path) ?? new Set<string>();
    set.add(row.visitor_hash);
    pageVisitors.set(row.path, set);
  }
  const pages: PageStat[] = [...pageViews.entries()]
    .map(([path, views]) => ({
      path,
      views,
      visitors: pageVisitors.get(path)?.size ?? 0,
      avgSeconds: views > 0 ? (pageSeconds.get(path) ?? 0) / views : 0,
    }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, 25);

  // Per visit: where it came from, where it landed, how long it lasted.
  const sources = new Map<string, number>();
  const places = new Map<string, number>();
  const devices = new Map<string, number>();
  const campaigns = new Map<string, number>();
  const summaries: VisitSummary[] = [];
  let quickExits = 0;
  let onlineNow = 0;
  const fiveMinutesAgo = now.getTime() - 5 * 60 * 1000;

  for (const [visitId, list] of visits) {
    const first = list[0];
    const seconds = list.reduce((sum, r) => sum + r.engaged_seconds, 0);
    const source = sourceLabel(first);
    const place = placeLabel(first);
    bump(sources, source);
    bump(places, place);
    bump(devices, first.device);
    if (first.utm_campaign) bump(campaigns, first.utm_campaign);
    if (list.length === 1 && seconds < 10) quickExits += 1;
    if (list.some((r) => new Date(r.last_seen_at).getTime() >= fiveMinutesAgo)) onlineNow += 1;
    summaries.push({
      visitId,
      startedAt: first.started_at,
      landingPage: first.path,
      pages: list.map((r) => r.path),
      seconds,
      source,
      place,
      device: first.device,
    });
  }

  // Per day, in Toledo's time zone.
  const dayViews = new Map<string, number>();
  const dayVisits = new Map<string, Set<string>>();
  const dayVisitors = new Map<string, Set<string>>();
  for (const row of sorted) {
    const day = dayKey.format(new Date(row.started_at));
    bump(dayViews, day);
    const v = dayVisits.get(day) ?? new Set<string>();
    v.add(row.visit_id);
    dayVisits.set(day, v);
    const p = dayVisitors.get(day) ?? new Set<string>();
    p.add(row.visitor_hash);
    dayVisitors.set(day, p);
  }
  const days: DayStat[] = [...dayViews.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((day) => ({
      day,
      views: dayViews.get(day) ?? 0,
      visits: dayVisits.get(day)?.size ?? 0,
      visitors: dayVisitors.get(day)?.size ?? 0,
    }));

  const visitCount = visits.size;
  return {
    visitors: visitorHashes.size,
    visits: visitCount,
    pageViews: sorted.length,
    avgVisitSeconds: visitCount > 0 ? totalSeconds / visitCount : 0,
    avgPageSeconds: sorted.length > 0 ? totalSeconds / sorted.length : 0,
    pagesPerVisit: visitCount > 0 ? sorted.length / visitCount : 0,
    quickExitShare: visitCount > 0 ? quickExits / visitCount : 0,
    onlineNow,
    days,
    pages,
    sources: rank(sources, visitCount, 12),
    places: rank(places, visitCount, 12),
    devices: rank(devices, visitCount, 3),
    campaigns: rank(campaigns, visitCount, 10),
    recentVisits: summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 40),
  };
}

export { formatDuration };

export const RANGES = [
  { key: "24h", label: "Last 24 hours", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
  { key: "90d", label: "Last 90 days", hours: 24 * 90 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export function rangeFor(key: string | undefined) {
  return RANGES.find((r) => r.key === key) ?? RANGES[1];
}
