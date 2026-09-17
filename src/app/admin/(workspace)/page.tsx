import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { OVERDUE_BUSINESS_DAYS } from "@/lib/limits";
import { formatDay } from "@/lib/queries/records";

export const dynamic = "force-dynamic";

type ReviewItem = {
  key: string;
  href: string;
  title: string;
  kind: string;
  aiDraft: boolean;
};

/**
 * Three things, and nothing else.
 *
 * Post a vote, because that is the job most often done from a phone straight
 * after a meeting. What is waiting to be reviewed. What an agency has not
 * answered. Counts of things already finished are not work, so there are no
 * stat tiles here.
 */
export default async function AdminDashboard() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Dashboard</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();

  const [votes, reports, listening, overdue] = await Promise.all([
    supabase
      .from("votes")
      .select("id, item_title, ai_draft, created_at, meetings(meeting_date)")
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

  // Machine written drafts first: they are the ones nobody has read yet.
  const reviewItems: ReviewItem[] = [
    ...(votes.data ?? []).map((v) => ({
      key: `vote-${v.id}`,
      href: `/admin/votes/${v.id}`,
      title: v.item_title,
      kind: v.meetings ? `Vote, ${formatDay(v.meetings.meeting_date)}` : "Vote",
      aiDraft: v.ai_draft,
    })),
    ...(reports.data ?? []).map((r) => ({
      key: `report-${r.id}`,
      href: `/admin/reports/${r.id}`,
      title: r.title,
      kind: "Report draft",
      aiDraft: false,
    })),
    ...(listening.data ?? []).map((l) => ({
      key: `listening-${l.id}`,
      href: "/admin/listening",
      title: `Listening session, ${formatDay(l.session_date)}`,
      kind: l.audience === "teachers" ? "Teachers" : "Parents",
      aiDraft: false,
    })),
  ].sort((a, b) => Number(b.aiDraft) - Number(a.aiDraft));

  const overdueRows = overdue.data ?? [];
  const nothingWaiting = reviewItems.length === 0 && overdueRows.length === 0;

  return (
    <>
      <h1>Dashboard</h1>

      {/* First thing on the screen: posting a vote is the most time sensitive
          task, and it is the one most often done from a phone after a meeting. */}
      <div className="admin-actions shortcut">
        <Link className="btn btn-large" href="/admin/votes">
          Post a vote
        </Link>
      </div>

      {nothingWaiting ? (
        <p className="nothing-waiting">Nothing waiting on you.</p>
      ) : (
        <>
          {reviewItems.length > 0 ? (
            <section className="uploader">
              <h2>Waiting for review</h2>
              <ul className="review-list">
                {reviewItems.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href}>{item.title}</Link>
                    <span className="review-kind">
                      {item.kind}
                      {item.aiDraft ? <span className="badge-ai">AI draft, unreviewed</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {overdueRows.length > 0 ? (
            <section className="uploader">
              <h2>No response after {OVERDUE_BUSINESS_DAYS} business days</h2>
              <ul className="review-list">
                {overdueRows.map((row) => (
                  <li key={row.id}>
                    <Link href="/admin/records">{row.request_text}</Link>
                    <span className="review-kind">
                      {row.agency_name}, filed {formatDay(row.date_filed!)}, {row.open_business_days}{" "}
                      business days open
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
