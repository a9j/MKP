import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { getPublishedExplainer } from "@/lib/queries/explainers";
import { TEMPLATE_LABEL } from "@/lib/explainer-types";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "An explainer from The Mona K Project";

export default async function Image({ params }: { params: { slug: string } }) {
  const explainer = await getPublishedExplainer("contract", params.slug);
  return renderOgImage(explainer?.title ?? TEMPLATE_LABEL.contract, TEMPLATE_LABEL.contract);
}
