import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { OVERDUE_BUSINESS_DAYS } from "@/lib/limits";
import { formatDay } from "@/lib/queries/records";
import { getReviewQueue, unreadFirst } from "@/lib/queries/review-queue";
import { getWatcherStatus, STALE_AFTER_HOURS } from "@/lib/queries/watchers";

export const dynamic = "force-dynamic";


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

  const [items, overdue, watchers] = await Promise.all([
    getReviewQueue(supabase),
    supabase
      .from("records_request_log")
      .select("id, agency_name, request_text, date_filed, open_business_days")
      .gt("open_business_days", OVERDUE_BUSINESS_DAYS)
      .order("open_business_days", { ascending: false }),
    getWatcherStatus(supabase),
  ]);

  // The records requests have their own section below, so they are not also
  // listed among the things waiting to be read.
  const reviewItems = unreadFirst(items.filter((item) => item.reviewKind !== "records"));

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
                      {item.detail}
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

      {/* Under the review list, deliberately: it is operational, not work. A
          collector that quietly stopped looks exactly like a quiet fortnight,
          so it says when each one was last heard from rather than leaving that
          to be noticed. */}
      <section className="watcher-status">
        <h2>Scheduled jobs</h2>
        <ul>
          {watchers.map((watcher) => (
            <li key={watcher.name} className={watcher.stale ? "stale" : undefined}>
              <span className="watcher-name">{watcher.label}</span>
              <span className="watcher-when">
                {watcher.lastRun
                  ? `last run ${formatWhen(watcher.lastRun)}, ${watcher.lastStatus}`
                  : "has never run"}
                {watcher.stale ? (
                  <strong>
                    {" "}
                    nothing has succeeded in {STALE_AFTER_HOURS} hours
                  </strong>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** "Oct 5, 7:02 am", which is what you want when checking a daily job. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
