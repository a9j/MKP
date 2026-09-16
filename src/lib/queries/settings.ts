import { createPublicClient } from "@/lib/supabase/public";

export type SiteSettings = Record<string, string>;

/**
 * Public site settings, keyed by setting name. RLS limits this to the rows
 * marked is_public, so an operational key can never arrive here.
 *
 * A key with an empty value is omitted, which lets callers fall back to the
 * [BRACKET] placeholder from the copy doc.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error) {
    throw new Error(`Could not load site settings: ${error.message}`);
  }

  const settings: SiteSettings = {};
  for (const row of data ?? []) {
    if (row.value && row.value.length > 0) settings[row.key] = row.value;
  }
  return settings;
}
