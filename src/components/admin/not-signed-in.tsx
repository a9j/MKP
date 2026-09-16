/** The same refusal on every admin screen, so none of them invents its own. */
export function NotSignedIn({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="admin-help">
        You are not signed in as an administrator. Sign in at{" "}
        <a href="/admin/login">/admin/login</a>.
      </p>
    </>
  );
}
