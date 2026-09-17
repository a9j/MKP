/**
 * Environment access. Every read goes through here so a missing variable fails
 * with a message that says what to set, rather than surfacing later as an
 * empty page or an unexplained fetch error.
 */

/** Treats a variable set to an empty string the same as one never set. */
function optional(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

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
  /**
   * The absolute origin. Open Graph images, the sitemap, confirmation links and
   * council preview links are all built from it, so it has to be a real URL.
   *
   * A variable set to an empty string is treated as absent. Vercel presents an
   * unset NEXT_PUBLIC_ variable that way, and "" is not a URL: building
   * metadataBase from it fails the whole build with "Invalid URL" and no clue
   * which variable is at fault.
   *
   * With nothing configured, a deployment describes itself by its own URL
   * rather than announcing localhost to anything that reads the page.
   */
  get siteUrl() {
    const configured = optional("NEXT_PUBLIC_SITE_URL");
    if (configured) return configured.replace(/\/+$/, "");

    const vercel = optional("VERCEL_URL");
    if (vercel) return `https://${vercel}`;

    return "http://localhost:3000";
  },
};
