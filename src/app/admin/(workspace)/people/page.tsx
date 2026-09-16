import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { PersonForm } from "@/components/admin/person-form";
import { NotSignedIn } from "@/components/admin/not-signed-in";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  staff: "Staff",
  board: "Board",
  advisory: "Advisory Council",
  body_member: "Body Member",
};

export default async function AdminPeoplePage() {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="People" />;

  const supabase = await createServerSupabase();
  const [{ data: bodies }, { data: people }] = await Promise.all([
    supabase.from("bodies").select("id, name").order("name"),
    supabase
      .from("people")
      .select("id, name, title, role, email, active, sort_order, bodies(name)")
      .order("role")
      .order("sort_order"),
  ]);

  return (
    <>
      <h1>People</h1>
      <p className="admin-help">
        Staff and council appear on the About page. Body members appear on Vote Watch
        and in the roll call when you post a vote. An email address is never published.
      </p>

      <section className="uploader">
        <h3>Add a person</h3>
        <PersonForm bodies={bodies ?? []} />
      </section>

      <section className="uploader">
        <h3>Everyone</h3>
        {(people ?? []).length === 0 ? (
          <p className="admin-help">Nobody yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Body</th>
                <th scope="col">Email</th>
                <th scope="col">Active</th>
              </tr>
            </thead>
            <tbody>
              {(people ?? []).map((person) => (
                <tr key={person.id}>
                  <th scope="row">{person.name}</th>
                  <td>{ROLE_LABEL[person.role] ?? person.role}</td>
                  <td>{person.bodies?.name ?? ""}</td>
                  <td>{person.email ?? ""}</td>
                  <td>{person.active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
