import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "We read what nobody has time to read.";

export default async function Image() {
  return renderOgImage("We read what nobody has time to read.", "About");
}
