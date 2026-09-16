import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ListeningForm } from "@/components/admin/listening-form";
import { formatDay } from "@/lib/queries/records";
import { NotSignedIn } from "@/components/admin/not-signed-in";

export const dynamic = "force-dynamic";

export default async function AdminListeningPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Listening sessions" />;

  const supabase = await createServerSupabase();
  const { data: sessions } = await supabase
    .from("listening_sessions")
    .select("id, session_date, audience, attendee_count, status")
    .order("session_date", { ascending: false });

  return (
    <>
      <h1>Listening sessions</h1>
      <p className="admin-help">
        What people told us, published in full, and what it changes about what we build
        next. A draft stays off the public page.
      </p>

      <section className="uploader">
        <h3>New summary</h3>
        <ListeningForm />
      </section>

      <section className="uploader">
        <h3>All sessions</h3>
        {(sessions ?? []).length === 0 ? (
          <p className="admin-help">Nothing yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Audience</th>
                <th scope="col" className="num">Attended</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((session) => (
                <tr key={session.id}>
                  <th scope="row">{formatDay(session.session_date)}</th>
                  <td>{session.audience === "teachers" ? "Teachers" : "Parents"}</td>
                  <td className="num">{session.attendee_count ?? ""}</td>
                  <td>{session.status === "published" ? "Published" : "Draft"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
