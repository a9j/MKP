import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The workspace and the unlisted review links are not for crawlers. Each
      // of those pages also carries its own noindex, this is the coarse net.
      disallow: ["/admin/", "/reports/preview/", "/subscribe/"],
    },
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
