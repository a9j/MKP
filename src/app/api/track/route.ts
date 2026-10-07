import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";
import {
  MAX_ENGAGED_SECONDS,
  cleanPath,
  cleanTag,
  decodeHeader,
  deviceFrom,
  isBot,
  isUuid,
  referrerHost,
} from "@/lib/tracking";

/**
 * Receives the visitor tracker's two messages:
 *
 *   start  a page was opened: where, from where, on what kind of device
 *   ping   how many seconds that page has been on screen so far
 *
 * Always answers 204, even for input it throws away, so the tracker never
 * retries and a broken payload never shows up as an error in a reader's
 * console. Nothing here sets a cookie or stores an IP address.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 2048;

function done() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "";
}

/** Rotates at midnight UTC, so a reader can be counted once a day and never followed. */
function visitorHash(request: NextRequest, userAgent: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${env.trackingSalt}|${day}|${clientIp(request)}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (isBot(userAgent)) return done();

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length === 0 || text.length > MAX_BODY) return done();
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return done();
    body = parsed as Record<string, unknown>;
  } catch {
    return done();
  }

  const id = body.id;
  if (!isUuid(id)) return done();
  const supabase = createServiceClient();

  if (body.e === "start") {
    const path = cleanPath(body.path);
    const visit = body.visit;
    if (!path || !isUuid(visit)) return done();

    const width = typeof body.w === "number" ? body.w : null;
    await supabase.from("page_views").insert({
      id,
      visit_id: visit,
      visitor_hash: visitorHash(request, userAgent),
      path,
      referrer_host: referrerHost(body.ref, request.headers.get("host") ?? ""),
      utm_source: cleanTag(body.utm_source),
      utm_medium: cleanTag(body.utm_medium),
      utm_campaign: cleanTag(body.utm_campaign),
      device: deviceFrom(userAgent, width),
      country: decodeHeader(request.headers.get("x-vercel-ip-country")),
      region: decodeHeader(request.headers.get("x-vercel-ip-country-region")),
      city: decodeHeader(request.headers.get("x-vercel-ip-city")),
    });
    return done();
  }

  if (body.e === "ping") {
    const seconds = typeof body.s === "number" ? Math.floor(body.s) : NaN;
    if (!Number.isFinite(seconds) || seconds < 0) return done();

    const { data: row } = await supabase
      .from("page_views")
      .select("started_at, engaged_seconds")
      .eq("id", id)
      .maybeSingle();
    if (!row) return done();

    // A page cannot have been on screen longer than it has been open, so a
    // forged ping cannot inflate the averages.
    const openFor = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000) + 5;
    const engaged = Math.min(seconds, openFor, MAX_ENGAGED_SECONDS);
    if (engaged <= row.engaged_seconds) return done();

    await supabase
      .from("page_views")
      .update({ engaged_seconds: engaged, last_seen_at: new Date().toISOString() })
      .eq("id", id);
    return done();
  }

  return done();
}
