/**
 * Environment access. Every read goes through here so a missing variable fails
 * with a message that says what to set, rather than surfacing later as an
 * empty page or an unexplained fetch error.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in. ` +
        `For local development run "bash scripts/local-supabase.sh" first.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};
