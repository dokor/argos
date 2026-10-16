export type Lang = "fr" | "en";

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

export function frenchPath(path: string): string {
  const pathname = path.replace(/\/+$/, "") || "/";
  if (pathname.startsWith("/en/report/") || pathname.startsWith("/en/share/")) return pathname.slice(3);
  if (pathname.startsWith("/en/account/admin/")) return pathname.slice(3);
  if ((pathname.startsWith("/en/account/domains/") || pathname.startsWith("/en/account/runs/") || pathname.startsWith("/en/account/sites/") || pathname.startsWith("/en/account/urls/"))) return pathname.slice(3);
  return Object.entries({ ...languageRoutes, ...accountRoutes }).find(([, en]) => en === pathname)?.[0] ?? pathname;
}

export function localizedPath(path: string, lang: Lang): string {
  const index = path.search(/[?#]/);
  const pathname = index < 0 ? path : path.slice(0, index);
  const suffix = index < 0 ? "" : path.slice(index);
  const fr = frenchPath(pathname);
  if (fr.startsWith("/report/") || fr.startsWith("/share/")) return (lang === "en" ? "/en" : "") + fr + suffix;
  if (fr.startsWith("/account/admin/")) return (lang === "en" ? "/en" : "") + fr + suffix;
  if ((fr.startsWith("/account/domains/") || fr.startsWith("/account/runs/") || fr.startsWith("/account/sites/") || fr.startsWith("/account/urls/"))) return (lang === "en" ? "/en" : "") + fr + suffix;
  return (lang === "en" ? accountRoutes[fr] ?? languageRoutes[fr] ?? fr : fr) + suffix;
}
