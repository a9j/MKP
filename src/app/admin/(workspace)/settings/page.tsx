import { getAdminUser } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/settings-form";
import { NotSignedIn } from "@/components/admin/not-signed-in";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await getAdminUser();
  if (!admin) return <NotSignedIn title="Settings" />;

  const supabase = await createServerSupabase();
  const [{ data: settings }, { data: agencies }] = await Promise.all([
    supabase.from("site_settings").select("key, value").order("key"),
    supabase.from("agencies").select("id, name, records_officer_email").order("name"),
  ]);

  return (
    <>
      <h1>Settings</h1>
      <p className="admin-help">
        An empty value shows on the site as the bracketed placeholder, so it is obvious
        what is still missing rather than silently blank.
      </p>

      <section className="uploader">
        <SettingsForm settings={settings ?? []} agencies={agencies ?? []} />
      </section>
    </>
  );
}
