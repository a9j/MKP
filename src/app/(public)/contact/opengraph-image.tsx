import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Write to us.";

export default async function Image() {
  return renderOgImage("Write to us.", "Contact");
}
