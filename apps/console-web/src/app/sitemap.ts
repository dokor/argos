import type { MetadataRoute } from "next";
import { languageRoutes } from "@/lib/i18n/routes";
import { languageAlternates } from "@/lib/i18n/metadata";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/exemple-rapport` },
    { url: `${SITE_URL}/a-propos` },
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
    {
      url: `${SITE_URL}/guides/checklist-audit-site-web`,
    },
    {
      url: `${SITE_URL}/methodologie-score`,
    },
  ].flatMap((entry) => {
    const path = entry.url.slice(SITE_URL.length) || "/";
    const en = languageRoutes[path];
    if (!en) return [entry];
    const alternates = { languages: languageAlternates(path) };
    return [{ ...entry, alternates }, { url: SITE_URL + en, alternates }];
  });
}
