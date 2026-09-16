import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "What the board decided, and who voted how.";

export default async function Image() {
  return renderOgImage("What the board decided, and who voted how.", "Vote Watch");
}
