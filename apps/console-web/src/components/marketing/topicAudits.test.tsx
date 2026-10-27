import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { frenchPath, localizedPath } from "@/lib/i18n/routes";
import { siteUrl } from "@/lib/i18n/metadata";
import LangToggle from "@/components/LangToggle";
import ResourcesPage from "@/app/(fr)/ressources/page";
import speedFr, { metadata as speedMetadataFr } from "@/app/(fr)/test-vitesse-site-web/page";
import speedEn, { metadata as speedMetadataEn } from "@/app/en/website-speed-test/page";
import seoFr, { metadata as seoMetadataFr } from "@/app/(fr)/analyse-seo-page/page";
import seoEn, { metadata as seoMetadataEn } from "@/app/en/page-seo-analysis/page";
import securityFr, { metadata as securityMetadataFr } from "@/app/(fr)/verifier-entetes-securite/page";
import securityEn, { metadata as securityMetadataEn } from "@/app/en/security-header-check/page";
import accessibilityFr, { metadata as accessibilityMetadataFr } from "@/app/(fr)/test-accessibilite-site-web/page";
import accessibilityEn, { metadata as accessibilityMetadataEn } from "@/app/en/website-accessibility-test/page";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));

const pages = [
  { fr: speedFr, en: speedEn, path: "/test-vitesse-site-web", enPath: "/en/website-speed-test", metadataFr: speedMetadataFr, metadataEn: speedMetadataEn },
  { fr: seoFr, en: seoEn, path: "/analyse-seo-page", enPath: "/en/page-seo-analysis", metadataFr: seoMetadataFr, metadataEn: seoMetadataEn },
  { fr: securityFr, en: securityEn, path: "/verifier-entetes-securite", enPath: "/en/security-header-check", metadataFr: securityMetadataFr, metadataEn: securityMetadataEn },
  { fr: accessibilityFr, en: accessibilityEn, path: "/test-accessibilite-site-web", enPath: "/en/website-accessibility-test", metadataFr: accessibilityMetadataFr, metadataEn: accessibilityMetadataEn },
];

describe("translated public diagnostics", () => {
  for (const page of pages) {
    it.each(["fr", "en"] as const)(`renders every section of ${page.path} in %s before hydration`, lang => {
      navigation.pathname = lang === "fr" ? page.path : page.enPath;
      const Component = page[lang];
      const html = renderToStaticMarkup(<LangProvider initialLang={lang}><Component /><LangToggle /></LangProvider>);
      expect(html).toContain(`lang="${lang}"`);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html.match(/<article/g)).toHaveLength(3);
      for (const id of ["audit-title", "measures-title", "example-title", "references"]) expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="${page.path}"`);
      expect(html).toContain(`href="${page.enPath}"`);
      expect(html).not.toContain("English guides — this page is available in French only");
      if (lang === "en") {
        for (const text of ["Analyze your page for free", "Illustrative evidence", "Suggested correction", "What to check next", "Limits to keep in mind", "Official references", "Estimated reading", "Contact by email"]) expect(html).toContain(text);
        expect(html).toContain('href="/en/about"');
        expect(html).toContain('href="/en/example-report"');
        expect(html).toContain('href="/en/scoring-method#resume"');
        expect(html).not.toContain("Diagnostic automatique");
        expect(html).not.toContain("Preuve illustrative");
        expect(html).not.toContain("Contacter par email");
      } else {
        expect(html).toContain("Analyser votre page gratuitement");
        expect(html).toContain("Preuve illustrative");
      }
    });

    it(`publishes reciprocal metadata and preserves suffixes for ${page.path}`, () => {
      const languages = { fr: siteUrl + page.path, en: siteUrl + page.enPath, "x-default": siteUrl + page.path };
      expect(page.metadataFr.alternates).toEqual({ canonical: languages.fr, languages });
      expect(page.metadataEn.alternates).toEqual({ canonical: languages.en, languages });
      expect(page.metadataEn.openGraph?.url).toBe(languages.en);
      expect(localizedPath(page.path + "?source=nav#references", "en")).toBe(page.enPath + "?source=nav#references");
      expect(localizedPath(page.enPath + "#audit", "fr")).toBe(page.path + "#audit");
    });
  }

  it("lists the four diagnostics in the English resources directory", () => {
    const html = renderToStaticMarkup(<LangProvider initialLang="en"><ResourcesPage /></LangProvider>);
    for (const page of pages) expect(html).toContain(`href="${page.enPath}"`);
  });

  it("keeps URL history on its existing translated route instead of sending visitors to guides", () => {
    const path = "/account/urls/42/history";
    expect(frenchPath("/en" + path)).toBe(path);
    expect(localizedPath(path + "?page=2#runs", "en")).toBe("/en" + path + "?page=2#runs");
    expect(localizedPath("/en" + path + "#runs", "fr")).toBe(path + "#runs");
    navigation.pathname = path;
    const html = renderToStaticMarkup(<LangProvider><LangToggle /></LangProvider>);
    expect(html).toContain(`href="/en${path}"`);
    expect(html).not.toContain("English guides");
  });
});
