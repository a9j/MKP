import { renderOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "What is on the ballot, and what is on the table.";

export default async function Image() {
  return renderOgImage("What is on the ballot, and what is on the table.", "Explainers");
}
