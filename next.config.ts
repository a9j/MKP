import type { NextConfig } from "next";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The photographs in public/photos, listed once at build. The home page draws
 * a navy block in any slot whose file is not here yet, so the layout is right
 * before the photos land. Reading the directory at request time would not
 * work on Vercel, where public/ is served from the CDN and is not on the
 * function's disk.
 */
function listPhotos(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public/photos")).filter((f) => /\.jpe?g$/i.test(f));
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  env: {
    MKP_PHOTOS: listPhotos().join(","),
  },
};

export default nextConfig;
