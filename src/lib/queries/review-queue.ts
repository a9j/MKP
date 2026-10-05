import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { OVERDUE_BUSINESS_DAYS } from "@/lib/limits";
import { formatDay } from "@/lib/queries/records";
import { bodyShortName } from "@/lib/bodies";
import type { ReviewItem } from "@/lib/review-queue";

/**
 * Everything waiting on a person, in one place.
 *
 * The dashboard and the daily digest have to agree about what "waiting" means,
 * so they read it from here rather than each deciding for itself. A count on a
 * screen and a count in an email that disagree is worse than either alone.
 */

export type { ReviewItem, ReviewKind } from "@/lib/review-queue";
export { groupForDigest, unreadFirst } from "@/lib/review-queue";

type Client = SupabaseClient<Database>;

export async function getReviewQueue(supabase: Client): Promise<ReviewItem[]> {
  const [votes, reports, listening, overdue] = await Promise.all([
    supabase
      .from("votes")
      .select("id, item_title, ai_draft, created_at, meetings(meeting_date, bodies(name, slug))")
      .eq("status", "draft")
      .order("created_at", { ascending: false }),
    supabase
      .from("reports")
      .select("id, title, updated_at")
      .eq("status", "draft")
      .order("updated_at", { ascending: false }),
    supabase
      .from("listening_sessions")
      .select("id, session_date, audience")
      .eq("status", "draft")
      .order("session_date", { ascending: false }),
    supabase
      .from("records_request_log")
      .select("id, agency_name, request_text, date_filed, open_business_days")
      .gt("open_business_days", OVERDUE_BUSINESS_DAYS)
      .order("open_business_days", { ascending: false }),
  ]);

  const items: ReviewItem[] = [];

  for (const vote of votes.data ?? []) {
    const body = vote.meetings?.bodies ?? null;
    items.push({
      key: `vote-${vote.id}`,
      href: `/admin/votes/${vote.id}`,
      title: vote.item_title,
      kind: "Vote",
      reviewKind: "vote",
      bodySlug: body?.slug ?? null,
      bodyLabel: bodyShortName(body?.slug ?? null, body?.name ?? "No body"),
      sortDate: vote.meetings?.meeting_date ?? vote.created_at,
      aiDraft: vote.ai_draft,
      detail: vote.meetings ? `Vote, ${formatDay(vote.meetings.meeting_date)}` : "Vote",
    });
  }

  for (const report of reports.data ?? []) {
    items.push({
      key: `report-${report.id}`,
      href: `/admin/reports/${report.id}`,
      title: report.title,
      kind: "Report draft",
      reviewKind: "report",
      bodySlug: null,
      bodyLabel: "The Mona K Project",
      sortDate: report.updated_at,
      aiDraft: false,
      detail: "Report draft",
    });
  }

  for (const session of listening.data ?? []) {
    items.push({
      key: `listening-${session.id}`,
      href: "/admin/listening",
      title: `Listening session, ${formatDay(session.session_date)}`,
      kind: "Listening draft",
      reviewKind: "listening",
      bodySlug: null,
      bodyLabel: "The Mona K Project",
      sortDate: session.session_date,
      aiDraft: false,
      detail: session.audience === "teachers" ? "Teachers" : "Parents",
    });
  }

  for (const row of overdue.data ?? []) {
    items.push({
      key: `records-${row.id}`,
      href: "/admin/records",
      title: row.request_text ?? "Records request",
      kind: "Records request",
      reviewKind: "records",
      bodySlug: null,
      bodyLabel: row.agency_name ?? "An agency",
      sortDate: row.date_filed ?? "",
      aiDraft: false,
      detail: `${row.agency_name}, filed ${row.date_filed ? formatDay(row.date_filed) : "not stated"}, ${row.open_business_days} business days open`,
    });
  }

  return items;
}

