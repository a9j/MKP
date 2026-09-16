import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "What do you actually make?";

export default async function Image() {
  return renderOgImage("What do you actually make?", "Toledo Teacher Pay Explorer");
}
