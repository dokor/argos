import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { siteUrl } from "@/lib/i18n/metadata";
import { dimensions, publicRoute } from "@/lib/analytics/contract";
import sitemap from "@/app/sitemap";
import ResourcesPage from "@/app/(fr)/ressources/page";
import WordPressFr, { metadata as wordpressFr } from "@/app/(fr)/ressources/audit-wordpress/page";
import ShopifyFr, { metadata as shopifyFr } from "@/app/(fr)/ressources/audit-shopify/page";
import ConversionFr, { metadata as conversionFr } from "@/app/(fr)/ressources/pourquoi-mon-site-ne-convertit-pas/page";
import WordPressEn, { metadata as wordpressEn } from "@/app/en/resources/wordpress-audit/page";
import ShopifyEn, { metadata as shopifyEn } from "@/app/en/resources/shopify-audit/page";
import ConversionEn, { metadata as conversionEn } from "@/app/en/resources/why-is-my-website-not-converting/page";
import { diagnosticPages, diagnosticRoutes } from "./diagnosticPages";

vi.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/ressources" }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("@/components/security/useAntiBot", () => ({ useAntiBot: () => ({ element: null }) }));

const pages = [
  { topic: "wordpress", lang: "fr", Page: WordPressFr, metadata: wordpressFr },
  { topic: "wordpress", lang: "en", Page: WordPressEn, metadata: wordpressEn },
  { topic: "shopify", lang: "fr", Page: ShopifyFr, metadata: shopifyFr },
  { topic: "shopify", lang: "en", Page: ShopifyEn, metadata: shopifyEn },
  { topic: "conversion", lang: "fr", Page: ConversionFr, metadata: conversionFr },
  { topic: "conversion", lang: "en", Page: ConversionEn, metadata: conversionEn },
] as const;

describe("public diagnostic pages", () => {
  it.each(pages)("renders $topic in $lang before hydration with its own metadata and links", ({ topic, lang, Page, metadata }) => {
    const html = renderToStaticMarkup(<LangProvider initialLang={lang}><Page /></LangProvider>);
    const content = diagnosticPages[topic][lang];
    const route = diagnosticRoutes[topic];
    const url = siteUrl + localizedPath(route, lang);
    expect(html).toContain(content.title);
    expect(html).toContain(content.scope);
    expect(html).toContain(content.limits[0]);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('href="#audit"');
    expect(html).toContain('id="audit"');
    expect(html).toContain('id="references"');
    expect(html).toContain(`href="${localizedPath("/exemple-rapport", lang)}"`);
    expect(html).not.toMatch(/href="\/(?:en\/)?report\//);
    expect(metadata.title).toBe(content.metaTitle);
    expect(metadata.description).toBe(content.description);
    expect(metadata.openGraph?.url).toBe(url);
    expect(metadata.openGraph?.title).toBe(content.metaTitle);
    expect(metadata.alternates?.canonical).toBe(url);
    const entries = sitemap().filter(entry => entry.url === url);
    expect(entries).toHaveLength(1);
    expect(entries[0].alternates?.languages).toEqual(metadata.alternates?.languages);
    expect(publicRoute(localizedPath(route, lang))).toBe(route);
    expect(dimensions({ route, lang, placement: "form" })).toEqual({ route, lang, placement: "form" });
    const resources = renderToStaticMarkup(<LangProvider initialLang={lang}><ResourcesPage /></LangProvider>);
    expect(resources).toContain(`href="${localizedPath(route, lang)}"`);
  });
});
