import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplainerView } from "@/components/explainers/explainer-view";
import { getAdminUser } from "@/lib/auth";
import { getExplainerPreview } from "@/lib/queries/admin-explainers";
import { getPublishedLevySlugs } from "@/lib/queries/explainers";

// Rendered per request for a signed in admin, never cached, never indexed.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explainer preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The admin preview, inside the public layout so it shows the real header,
 * footer and type. Only a signed in admin gets anything but a 404, and the
 * content comes from build_explainer_snapshot() through their own session.
 */
export default async function ExplainerPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getAdminUser())) notFound();

  const [preview, levySlugs] = await Promise.all([getExplainerPreview(id), getPublishedLevySlugs()]);
  if (!preview) notFound();

  const { explainer, status, problems } = preview;

  return (
    <>
      <div className="preview-banner" role="status">
        <strong>
          {explainer.isSample ? "Sample preview" : status === "published" ? "Preview of unpublished changes" : "Draft preview"}
        </strong>
        <span>
          {problems.length === 0
            ? "Ready to publish. "
            : `${problems.length} thing${problems.length === 1 ? "" : "s"} to fix before publishing. `}
          <Link href={`/admin/explainers/${id}`} className="preview-banner-link">
            Back to the editor
          </Link>
        </span>
      </div>
      <ExplainerView explainer={explainer} publishedLevySlugs={levySlugs} />
    </>
  );
}
