import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Anonymous read client for public pages.
 *
 * Deliberately not the cookie bound client from @supabase/ssr. Reading cookies
 * opts a route out of static rendering, and the public pages are built with ISR
 * and refreshed by revalidatePath on an admin save. Nothing on a public page
 * depends on who is asking, so the anonymous key with RLS is the right level of
 * access: drafts and the admin tables are unreachable through it.
 */
export function createPublicClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
