import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Everything starts with a records request.";

export default async function Image() {
  return renderOgImage("Everything starts with a records request.", "Records Desk");
}
