import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDay } from "@/lib/queries/records";
import { ScrollableTable } from "@/components/public/scrollable-table";

export const dynamic = "force-dynamic";

export default async function AdminMeetingsPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return (
      <>
        <h1>Meetings</h1>
        <p className="admin-help">
          You are not signed in as an administrator. Sign in at{" "}
          <a href="/admin/login">/admin/login</a>.
        </p>
      </>
    );
  }

  const supabase = await createServerSupabase();
  const [{ data: meetings }, { data: documents }] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id, meeting_date, kind, agenda_url, minutes_url, video_url, discovered_by, bodies(name), votes(id, status, ai_draft)",
      )
      .order("meeting_date", { ascending: false })
      .limit(60),
    supabase.from("documents").select("owner_id").eq("owner_type", "meeting"),
  ]);

  const attachmentCount = new Map<string, number>();
  for (const doc of documents ?? []) {
    if (doc.owner_id) attachmentCount.set(doc.owner_id, (attachmentCount.get(doc.owner_id) ?? 0) + 1);
  }

  return (
    <>
      <h1>Meetings</h1>
      <p className="admin-help">
        One row per meeting, with the votes posted from it. Meetings are added from
        the vote form, or by the agenda watcher once that is switched on.{" "}
        <Link href="/admin/votes">Post a vote</Link>
      </p>

      <section className="uploader">
        {(meetings ?? []).length === 0 ? (
          <p className="admin-help">No meetings recorded yet.</p>
        ) : (
          <ScrollableTable label="Meetings">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Body</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Documents</th>
                  <th scope="col">Votes</th>
                  <th scope="col">Added by</th>
                  <th scope="col">Links</th>
                </tr>
              </thead>
              <tbody>
                {(meetings ?? []).map((meeting) => {
                  const votes = meeting.votes ?? [];
                  const published = votes.filter((v) => v.status === "published").length;
                  const drafts = votes.length - published;
                  return (
                    <tr key={meeting.id}>
                      <th scope="row">{formatDay(meeting.meeting_date)}</th>
                      <td>{meeting.bodies?.name ?? "Not stated"}</td>
                      <td>{meeting.kind === "special" ? "Special" : "Regular"}</td>
                      <td className="num">{attachmentCount.get(meeting.id) ?? 0}</td>
                      <td>
                        {published} published
                        {drafts > 0 ? `, ${drafts} draft` : ""}
                      </td>
                      <td>{meeting.discovered_by === "watcher" ? "Agenda watcher" : "By hand"}</td>
                      <td>
                        <span className="meeting-links">
                          {meeting.agenda_url ? (
                            <a href={meeting.agenda_url} target="_blank" rel="noopener noreferrer">
                              Agenda
                            </a>
                          ) : null}
                          {meeting.minutes_url ? (
                            <a href={meeting.minutes_url} target="_blank" rel="noopener noreferrer">
                              Minutes
                            </a>
                          ) : null}
                          {meeting.video_url ? (
                            <a href={meeting.video_url} target="_blank" rel="noopener noreferrer">
                              Video
                            </a>
                          ) : null}
                          {!meeting.agenda_url && !meeting.minutes_url && !meeting.video_url ? (
                            <span className="unavailable">None recorded</span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </section>
    </>
  );
}
