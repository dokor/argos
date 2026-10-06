import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
    },
    {
      url: `${SITE_URL}/faq`,
    },
    {
      url: `${SITE_URL}/audit-site-pme`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/audit-site-ecommerce`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/accessibilite-numerique`,
    },
  ];
}
