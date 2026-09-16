import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Voting records by member";

export default async function Image() {
  return renderOgImage("Voting records by member", "Vote Watch");
}
