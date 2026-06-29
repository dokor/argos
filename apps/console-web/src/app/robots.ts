import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Standard crawlers: index only the public landing page.
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard/",  // admin console — auth-gated
          "/login/",      // login page — no value for indexing
          "/api/",        // REST API — never index
          "/report/",     // reports are private (token-gated) — also set noindex per-page
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
