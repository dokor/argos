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
      url: `${SITE_URL}/ressources`,
    },
    {
      url: `${SITE_URL}/ressources/audit-site-pme`,
    },
    {
      url: `${SITE_URL}/ressources/audit-site-ecommerce`,
    },
    {
      url: `${SITE_URL}/ressources/accessibilite-numerique`,
    },
    {
      url: `${SITE_URL}/ressources/audit-technique-gratuit`,
    },
  ];
}
