import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { VoteForm } from "@/components/admin/vote-form";
import { formatDay } from "@/lib/queries/records";

export const dynamic = "force-dynamic";

export default async function AdminVotesPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotAdmin />;

  const supabase = await createServerSupabase();
  const [{ data: bodies }, { data: votes }, { data: members }] = await Promise.all([
    supabase.from("bodies").select("id, name, slug").order("name"),
    supabase
      .from("votes")
      .select("id, meeting_date, item_title, yes_count, no_count, abstain_count, absent_count, bodies(name)")
      .order("meeting_date", { ascending: false })
      .limit(20),
    supabase.from("people").select("body_id").eq("role", "body_member").eq("active", true),
  ]);

  // A body with no members has no roll call, so the form would open unusable.
  // Bodies that can actually be voted on come first.
  const memberCounts = new Map<string, number>();
  for (const person of members ?? []) {
    if (person.body_id) memberCounts.set(person.body_id, (memberCounts.get(person.body_id) ?? 0) + 1);
  }
  const orderedBodies = [...(bodies ?? [])].sort((a, b) => {
    const diff = (memberCounts.get(b.id) ?? 0) - (memberCounts.get(a.id) ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  return (
    <>
      <h1>Post a vote</h1>
      <p className="admin-help">
        Saving publishes straight away. The tally is counted from the roll call, so
        there is no separate number to keep in step.
      </p>

      <section className="uploader">
        <VoteForm bodies={orderedBodies} />
      </section>

      <section className="uploader">
        <h3>Recently published</h3>
        {(votes ?? []).length === 0 ? (
          <p className="admin-help">Nothing published yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Meeting</th>
                <th scope="col">Item</th>
                <th scope="col">Body</th>
                <th scope="col">Tally</th>
              </tr>
            </thead>
            <tbody>
              {(votes ?? []).map((vote) => (
                <tr key={vote.id}>
                  <td>{formatDay(vote.meeting_date)}</td>
                  <th scope="row">{vote.item_title}</th>
                  <td>{vote.bodies?.name ?? "Not stated"}</td>
                  <td>
                    {vote.yes_count} yes, {vote.no_count} no
                  </td>
                </tr>
              ))}
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
