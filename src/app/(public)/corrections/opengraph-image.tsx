import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Every correction we have made.";

export default async function Image() {
  return renderOgImage("Every correction we have made.", "Corrections");
}
