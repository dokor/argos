export type Lang = "fr" | "en";

// Only pages with a complete English version belong in this map.
export const languageRoutes: Record<string, string> = {
  "/": "/en",
  "/exemple-rapport": "/en/example-report",
  "/faq": "/en/faq",
  "/a-propos": "/en/about",
  "/ressources": "/en/resources",
  "/ressources/audit-site-pme": "/en/resources/small-business-website-audit",
  "/ressources/audit-site-ecommerce": "/en/resources/ecommerce-website-audit",
};

export function frenchPath(path: string): string {
  const pathname = path.replace(/\/+$/, "") || "/";
  if (pathname.startsWith("/en/report/")) return pathname.slice(3);
  return Object.entries(languageRoutes).find(([, en]) => en === pathname)?.[0] ?? pathname;
}

export function localizedPath(path: string, lang: Lang): string {
  const index = path.search(/[?#]/);
  const pathname = index < 0 ? path : path.slice(0, index);
  const suffix = index < 0 ? "" : path.slice(index);
  const fr = frenchPath(pathname);
  if (fr.startsWith("/report/")) return (lang === "en" ? "/en" : "") + fr + suffix;
  return (lang === "en" ? languageRoutes[fr] ?? fr : fr) + suffix;
}
