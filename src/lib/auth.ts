import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export type AdminUser = { email: string };

/**
 * The signed in administrator, or null.
 *
 * Membership is checked against the admins table rather than inferred from
 * having a session, so signing in is not by itself permission to do anything.
 * The admins table is readable only to admins, so a non admin sees no rows and
 * falls through to null.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data, error } = await supabase
    .from("admins")
    .select("email")
    .ilike("email", user.email)
    .maybeSingle();

  if (error || !data) return null;
  return { email: user.email };
}

export class NotAnAdminError extends Error {
  constructor() {
    super("You are not signed in as an administrator.");
    this.name = "NotAnAdminError";
  }
}

/** Throws unless the caller is a signed in administrator. */
export async function requireAdminUser(): Promise<AdminUser> {
  const admin = await getAdminUser();
  if (!admin) throw new NotAnAdminError();
  return admin;
}
