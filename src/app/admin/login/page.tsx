import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="login">
      <h1>Sign in</h1>
      <p className="admin-help">
        We email you a link. There is no password to remember, and none to lose.
        Only addresses on the administrator list can sign in.
      </p>
      {params.error ? (
        <p className="login-error" role="alert">
          {params.error}
        </p>
      ) : null}
      <LoginForm next={params.next ?? "/admin"} />
    </div>
  );
}
