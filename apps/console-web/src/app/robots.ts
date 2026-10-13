import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr";

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
