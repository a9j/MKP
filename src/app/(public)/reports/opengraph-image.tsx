import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "We publish when the numbers matter.";

export default async function Image() {
  return renderOgImage("We publish when the numbers matter.", "Reports");
}
