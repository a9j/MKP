import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Service role client. Bypasses RLS, so it is server only and is used for the
 * few reads and writes that must see past the public policies: the unlisted
 * report preview route, and the admin writes added in later phases.
 *
 * The "server-only" import makes importing this from a client component a build
 * error rather than a leaked key.
 */
export function createServiceClient() {
  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
