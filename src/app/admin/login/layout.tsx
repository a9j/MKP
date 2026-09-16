/**
 * Sign in sits outside the workspace shell. A signed out visitor should not be
 * shown a navigation rail into pages they cannot open, or a sign out button.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin admin-plain">
      <main id="main">{children}</main>
    </div>
  );
}
