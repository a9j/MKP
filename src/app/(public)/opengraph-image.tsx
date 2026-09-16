import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "The records are public. Now they are readable.";

export default async function Image() {
  return renderOgImage("The records are public. Now they are readable.");
}
