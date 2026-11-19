import type { Metadata } from "next";
import { localizedPath, languageRoutes, type Lang } from "./routes";
import { locales } from "./locales";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://argos.lelouet.fr").replace(/\/+$/, "");
export function languageAlternates(path: string): Record<string,string> {
  const fr = siteUrl + (path === "/" ? "" : path);
  return languageRoutes[path] ? { ...Object.fromEntries(locales.map(({ code }) => [code, code === "fr" ? fr : siteUrl + localizedPath(path, code)])), "x-default": fr } : { fr, "x-default": fr };
}
export function localizedMetadata(path: string, lang: Lang, title: string, description: string): Metadata {
  const url = siteUrl + (path === "/" && lang === "fr" ? "" : localizedPath(path, lang));
  return {
    title: path === "/" ? { absolute: title } : title, description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website", url, title, description, siteName: "Argos",
      locale: locales.find(locale => locale.code === lang)!.region,
      alternateLocale: languageRoutes[path] ? locales.filter(locale => locale.code !== lang).map(locale => locale.region) : undefined,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Argos" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}
