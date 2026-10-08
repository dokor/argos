import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "./LangContext";
import { languageRoutes, localizedPath } from "./routes";
import { localizedMetadata, siteUrl } from "./metadata";
import sitemap from "@/app/sitemap";
import FaqPage from "@/app/(fr)/faq/page";
import LangToggle from "@/components/LangToggle";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/faq" }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));

describe("server-rendered language routes", () => {
  it("renders English content and crawlable language links without hydration", () => {
    const html = renderToStaticMarkup(<LangProvider initialLang="en"><FaqPage /><LangToggle /></LangProvider>);
    expect(html).toContain("Frequently asked questions");
    expect(html).toContain('href="/en"');
    expect(html).toContain('href="/faq"');
    expect(html).toContain('hrefLang="en"');
    expect(html).toContain('href="/en/faq"');
  });

  it("preserves anchors and queries and keeps untranslated articles on their existing URLs", () => {
    expect(localizedPath("/faq?source=nav#privacy", "en")).toBe("/en/faq?source=nav#privacy");
    expect(localizedPath("/en/faq#limits", "fr")).toBe("/faq#limits");
    expect(localizedPath("/ressources/accessibilite-numerique", "en")).toBe("/ressources/accessibilite-numerique");
    expect(localizedPath("/report/token", "en")).toBe("/en/report/token");
  });

  it("advertises reciprocal languages and self canonicals for every translated page", () => {
    const entries = sitemap();
    for (const [fr, en] of Object.entries(languageRoutes)) {
      const frUrl = siteUrl + (fr === "/" ? "" : fr);
      const enUrl = siteUrl + en;
      const french = localizedMetadata(fr, "fr", "Titre", "Description");
      const english = localizedMetadata(fr, "en", "Title", "Description");
      expect(french.alternates?.canonical).toBe(frUrl);
      expect(english.alternates?.canonical).toBe(enUrl);
      expect(french.alternates?.languages).toEqual(english.alternates?.languages);
      expect(entries.find(entry => entry.url === enUrl)?.alternates?.languages).toEqual({ fr: frUrl, en: enUrl, "x-default": frUrl });
    }
    expect(entries.some(entry => entry.url.includes("/report/"))).toBe(false);
  });
});
