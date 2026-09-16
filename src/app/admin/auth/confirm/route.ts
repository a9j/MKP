import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Turns the token from the emailed link into a session.
 *
 * Signing in is not the same as being allowed in. Membership is checked
 * against the admins table here so a stranger who requested a link lands on a
 * clear refusal rather than an empty workspace.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/admin";

  const fail = (message: string) => {
    const url = new URL("/admin/login", origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  };

  if (!tokenHash || !type) {
    return fail("That sign in link is incomplete. Ask for a new one.");
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return fail("That sign in link has already been used or has expired. Ask for a new one.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: admin } = await supabase
    .from("admins")
    .select("email")
    .ilike("email", user?.email ?? "")
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    return fail("That address is not on the administrator list.");
  }

  // Only ever redirect inside this site.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return NextResponse.redirect(new URL(target, origin));
}
