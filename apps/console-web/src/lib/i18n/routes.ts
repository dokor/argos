import { isLang, type Lang } from "./locales";
export type { Lang } from "./locales";

// Only pages with a complete English version belong in this map.
export const accountRoutes: Record<string, string> = {
  "/account/domains": "/en/account/domains",
  "/account/usage": "/en/account/usage",
  "/account/settings": "/en/account/settings",
  "/account/analyses/new": "/en/account/analyses/new",
  "/account/integrations": "/en/account/integrations",
  "/account/design-preview": "/en/account/design-preview",
  "/feedback": "/en/feedback",
  "/account/admin/feedback": "/en/account/admin/feedback",
  "/account/admin/analytics": "/en/account/admin/analytics",
  "/account/admin/analytics/overview": "/en/account/admin/analytics/overview",
  "/account/admin/analytics/problems": "/en/account/admin/analytics/problems",
  "/account/admin/analytics/traffic": "/en/account/admin/analytics/traffic",
  "/account/admin/users": "/en/account/admin/users",
  "/account/admin/events": "/en/account/admin/events",
  "/account/admin/runs": "/en/account/admin/runs",
  "/account/admin": "/en/account/admin",
  "/account/sites": "/en/account/sites",
  "/account": "/en/account",
  "/account/sign-in": "/en/account/sign-in",
  "/account/register": "/en/account/register",
  "/account/verify": "/en/account/verify",
  "/account/forgot": "/en/account/forgot",
  "/account/reset": "/en/account/reset",
};
export const languageRoutes: Record<string, string> = {
  "/guides/cls-eleve": "/en/guides/high-cls",
  "/guides/refonte-site-web": "/en/guides/website-redesign",
  "/guides/accessibilite-moteurs-ia": "/en/guides/ai-search-accessibility",
  "/guides/checklist-audit-ecommerce": "/en/guides/ecommerce-audit-checklist",
  "/guides/lcp-lent": "/en/guides/slow-lcp",
  "/guides/content-security-policy": "/en/guides/content-security-policy",
  "/guides/hsts": "/en/guides/hsts",
  "/test-vitesse-site-web": "/en/website-speed-test",
  "/analyse-seo-page": "/en/page-seo-analysis",
  "/verifier-entetes-securite": "/en/security-header-check",
  "/test-accessibilite-site-web": "/en/website-accessibility-test",
  "/": "/en",
  "/conditions-utilisation": "/en/terms-of-use",
  "/confidentialite": "/en/privacy",
  "/informations-legales": "/en/legal-information",
  "/exemple-rapport": "/en/example-report",
  "/faq": "/en/faq",
  "/a-propos": "/en/about",
  "/guides/checklist-audit-site-web": "/en/guides/website-audit-checklist",
  "/methodologie-score": "/en/scoring-method",
  "/ressources/audit-technique-gratuit": "/en/resources/free-technical-audit",
  "/ressources/accessibilite-numerique": "/en/resources/digital-accessibility",
  "/ressources": "/en/resources",
  "/ressources/audit-site-pme": "/en/resources/small-business-website-audit",
  "/ressources/audit-site-ecommerce": "/en/resources/ecommerce-website-audit",
  "/ressources/audit-wordpress": "/en/resources/wordpress-audit",
  "/ressources/audit-shopify": "/en/resources/shopify-audit",
  "/ressources/pourquoi-mon-site-ne-convertit-pas": "/en/resources/why-is-my-website-not-converting",
};

const nonIndexedRoutes: Record<string, string> = {
  ...accountRoutes,
  "/demonstrations/cls/avant": "/en/demonstrations/cls/avant",
  "/demonstrations/cls/apres": "/en/demonstrations/cls/apres",
};

export function frenchPath(path: string): string {
  const pathname = path.replace(/\/+$/, "") || "/";
  const prefix = pathname.split("/")[1];
  if (!isLang(prefix)) return pathname;
  const bare = pathname.slice(prefix.length + 1) || "/";
  if (prefix === "fr") return bare;
  if (/^\/(?:account|report|share)(?:\/|$)/.test(bare)) return bare;
  return Object.entries({ ...languageRoutes, ...nonIndexedRoutes }).find(([, en]) => en === "/en" + (bare === "/" ? "" : bare))?.[0] ?? pathname;
}

export function localizedPath(path: string, lang: Lang): string {
  const index = path.search(/[?#]/);
  const pathname = index < 0 ? path : path.slice(0, index);
  const suffix = index < 0 ? "" : path.slice(index);
  const fr = frenchPath(pathname);
  if (pathname === "/downloads/grille-recette-refonte.csv" && lang !== "fr") return `/downloads/${lang}/grille-recette-refonte.csv` + suffix;
  if (lang === "fr") return fr + suffix;
  if (/^\/(?:account|report|share)(?:\/|$)/.test(fr)) return "/" + lang + fr + suffix;
  const english = nonIndexedRoutes[fr] ?? languageRoutes[fr];
  return (english ? "/" + lang + english.slice(3) : fr) + suffix;
}
