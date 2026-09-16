import type { Metadata } from "next";
import { AdminRail } from "@/components/admin/admin-rail";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Workspace shell. Same tokens as the public site, but the grey band becomes
 * the page background so it does not read as a published page.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin">
      <AdminRail />
      <main className="admin-main" id="main">
        <div className="admin-inner">{children}</div>
      </main>
    </div>
  );
}
