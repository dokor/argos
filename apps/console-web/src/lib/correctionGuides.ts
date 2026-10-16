import type { Lang } from "./i18n/routes";
type Guide = { published: boolean; hrefs: Partial<Record<Lang,string>>; labels: Partial<Record<Lang,string>> };
// Publication is explicit. A planned route must not become a link accidentally.
export const correctionGuides: Record<string, Guide> = {
  html: { published: true, hrefs: { fr: "/guides/checklist-audit-site-web#html-seo", en: "/en/guides/website-audit-checklist#html-seo" }, labels: { fr: "Vérifier et corriger le HTML de la page", en: "Check and fix the page HTML" } },
  images: { published: true, hrefs: { fr: "/guides/checklist-audit-site-web#accessibilite", en: "/en/guides/website-audit-checklist#accessibilite" }, labels: { fr: "Vérifier les alternatives et les parcours accessibles", en: "Check alternatives and accessible journeys" } },
  lcp: { published: true, hrefs: { fr: "/guides/lcp-lent", en: "/en/guides/slow-lcp" }, labels: { fr: "Comprendre et améliorer le LCP", en: "Understand and improve LCP" } },
  csp: { published: true, hrefs: { fr: "/guides/content-security-policy", en: "/en/guides/content-security-policy" }, labels: { fr: "Préparer une CSP adaptée", en: "Prepare a suitable CSP" } },
  hsts: { published: true, hrefs: { fr: "/guides/hsts", en: "/en/guides/hsts" }, labels: { fr: "Configurer HSTS selon le périmètre HTTPS", en: "Configure HSTS for your HTTPS scope" } },
};
const checkGuides: Readonly<Record<string,string>> = {
  "html.title": "html", "html.meta.description.present": "html", "html.link.canonical.present": "html", "html.h1.count": "html",
  "html.images.alt_coverage": "images",
  "lighthouse.audit.largest-contentful-paint": "lcp", "runtime.lcp": "lcp",
  "http.security.csp": "csp", "http.security.hsts": "hsts", "ssl.hsts": "hsts",
};
export function correctionGuide(checkKey: string | null | undefined, lang: Lang): { href: string; label: string } | undefined {
  if (!checkKey || !Object.hasOwn(checkGuides,checkKey)) return undefined;
  const guide = correctionGuides[checkGuides[checkKey]];
  if (!guide?.published) return undefined;
  const href = guide.hrefs[lang]; const label = guide.labels[lang];
  if (!href || !label || !href.startsWith("/") || href.startsWith("//") || href.includes("?")) return undefined;
  return { href, label };
}
