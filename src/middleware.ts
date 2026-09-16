import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the session cookie fresh and keeps signed out visitors out of /admin.
 *
 * The redirect here is a convenience, not the security boundary. Every admin
 * page and every server action checks for an administrator itself, and RLS
 * refuses the write regardless, so a request that slips past this still cannot
 * read or change anything.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes an expiring session. Must be called before anything reads it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicAuthRoute =
    pathname === "/admin/login" || pathname.startsWith("/admin/auth");

  if (!user && pathname.startsWith("/admin") && !isPublicAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    // So the sign in can return them to where they were headed.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
