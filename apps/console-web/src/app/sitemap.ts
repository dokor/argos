import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      // Alternate language versions — fr is canonical, en available via toggle
      alternates: {
        languages: {
          fr: SITE_URL,
          en: SITE_URL, // same URL, language switch is client-side
        },
      },
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: {
          fr: `${SITE_URL}/faq`,
          en: `${SITE_URL}/faq`, // same URL, language switch is client-side
        },
      },
    },
  ];
}
