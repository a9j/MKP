import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getPublishedReport } from "@/lib/queries/reports";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A report from The Mona K Project";

export default async function Image({ params }: { params: { slug: string } }) {
  const report = await getPublishedReport(params.slug);
  return renderOgImage(report?.title ?? "Report", report?.typeLabel ?? "Reports");
}
