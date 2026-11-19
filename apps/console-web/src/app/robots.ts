import type { MetadataRoute } from "next";

import { siteUrl as SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Reports must be crawlable to read noindex; their opaque links are not listed.
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",        // REST API - never index
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
