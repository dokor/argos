import type { Metadata } from "next";
import { localizedPath, type Lang } from "./routes";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
export function languageAlternates(path: string) {
  const fr = siteUrl + (path === "/" ? "" : path);
  return { fr, en: siteUrl + localizedPath(path, "en"), "x-default": fr };
}
export function localizedMetadata(path: string, lang: Lang, title: string, description: string): Metadata {
  const url = siteUrl + (path === "/" && lang === "fr" ? "" : localizedPath(path, lang));
  return {
    title, description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website", url, title, description, siteName: "Argos",
      locale: lang === "en" ? "en_US" : "fr_FR",
      alternateLocale: lang === "en" ? "fr_FR" : "en_US",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argos" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}
