import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Help Toledo read its own records.";

export default async function Image() {
  return renderOgImage("Help Toledo read its own records.", "Get Involved");
}
