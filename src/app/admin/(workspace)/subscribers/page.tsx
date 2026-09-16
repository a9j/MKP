import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPublishNoticeContext } from "@/lib/actions/admin";
import { SubscribersPanel } from "@/components/admin/subscribers-panel";
import { NotSignedIn } from "@/components/admin/not-signed-in";
import { formatDay } from "@/lib/queries/records";

export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Subscribers" />;

  const supabase = await createServerSupabase();
  const [{ data: subscribers }, context] = await Promise.all([
    supabase
      .from("subscribers")
      .select("id, email, confirmed, created_at")
      .order("created_at", { ascending: false }),
    getPublishNoticeContext(),
  ]);

  const rows = subscribers ?? [];
  const waiting = rows.filter((s) => !s.confirmed).length;

  return (
    <>
      <h1>Subscribers</h1>
      <p className="admin-help">
        One email when we publish. Nothing goes out automatically: a notice is only
        sent when you press the button below.
      </p>

      <dl className="diff">
        <div>
          <dt>Confirmed</dt>
          <dd>{context.confirmedCount}</dd>
        </div>
        <div>
          <dt>Waiting to confirm</dt>
          <dd>{waiting}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{rows.length}</dd>
        </div>
      </dl>

      <section className="uploader">
        <h3>Send a publish notice</h3>
        <SubscribersPanel context={context} />
      </section>

      <section className="uploader">
        <h3>Everyone</h3>
        {rows.length === 0 ? (
          <p className="admin-help">Nobody has subscribed yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Confirmed</th>
                <th scope="col">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((subscriber) => (
                <tr key={subscriber.id}>
                  <th scope="row">{subscriber.email}</th>
                  <td>{subscriber.confirmed ? "Yes" : "Not yet"}</td>
                  <td>{formatDay(subscriber.created_at.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
