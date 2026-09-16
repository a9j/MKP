import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

/**
 * Cookie bound client, for anything that depends on who is asking.
 *
 * Writes go through this rather than the service role client on purpose: the
 * caller keeps their own identity, so RLS stays the thing that decides what
 * they may touch. A bug in an admin screen cannot turn into a write nobody
 * was allowed to make.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read only.
          // Refreshing the session is the middleware's job in that case.
        }
      },
    },
  });
}
