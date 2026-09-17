import Link from "next/link";
import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { VoteForm } from "@/components/admin/vote-form";
import { getBodiesByMemberCount, getMeetingOptions } from "@/lib/queries/admin-votes";
import { formatDay } from "@/lib/queries/records";

export const dynamic = "force-dynamic";

export default async function AdminVotesPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotAdmin />;

  const supabase = await createServerSupabase();
  const [bodies, meetings, { data: votes }] = await Promise.all([
    getBodiesByMemberCount(),
    getMeetingOptions(),
    supabase
      .from("votes")
      .select(
        "id, item_title, status, ai_draft, published_at, created_at, meetings(meeting_date, bodies(name)), vote_members(vote)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <>
      <h1>Post a vote</h1>
      <p className="admin-help">
        Publish puts it on the site straight away. Save as draft keeps it here until
        the minutes are out. The tally is counted from the roll call, so there is no
        separate number to keep in step.
      </p>

      <section className="uploader">
        <VoteForm bodies={bodies} meetings={meetings} />
      </section>

      <section className="uploader">
        <h3>Recent votes</h3>
        {(votes ?? []).length === 0 ? (
          <p className="admin-help">Nothing recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Meeting</th>
                <th scope="col">Item</th>
                <th scope="col">Body</th>
                <th scope="col">Tally</th>
                <th scope="col">State</th>
              </tr>
            </thead>
            <tbody>
              {(votes ?? []).map((vote) => {
                const members = vote.vote_members ?? [];
                const yes = members.filter((m) => m.vote === "yes").length;
                const no = members.filter((m) => m.vote === "no").length;
                return (
                  <tr key={vote.id}>
                    <td>{vote.meetings ? formatDay(vote.meetings.meeting_date) : "Not stated"}</td>
                    <th scope="row">
                      {vote.status === "draft" ? (
                        <Link href={`/admin/votes/${vote.id}`}>{vote.item_title}</Link>
                      ) : (
                        vote.item_title
                      )}
                    </th>
                    <td>{vote.meetings?.bodies?.name ?? "Not stated"}</td>
                    <td>
                      {members.length === 0 ? "No roll call yet" : `${yes} yes, ${no} no`}
                    </td>
                    <td>
                      {vote.ai_draft ? (
                        <span className="badge-ai">AI draft, unreviewed</span>
                      ) : vote.status === "draft" ? (
                        <span className="badge-draft">Draft</span>
                      ) : (
                        "Published"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function NotAdmin() {
  return (
    <>
      <h1>Post a vote</h1>
      <p className="admin-help">
        You are not signed in as an administrator. Sign in at{" "}
        <a href="/admin/login">/admin/login</a>.
      </p>
    </>
  );
}
