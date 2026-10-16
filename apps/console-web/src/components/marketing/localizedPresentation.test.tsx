// @vitest-environment jsdom
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LangProvider } from "@/lib/i18n/LangContext";
import { frenchPath, localizedPath, type Lang } from "@/lib/i18n/routes";
import HomeFr from "@/app/(fr)/page";
import HomeEn from "@/app/en/page";
import ResourcesFr from "@/app/(fr)/ressources/page";
import ResourcesEn from "@/app/en/resources/page";
import FaqFr from "@/app/(fr)/faq/page";
import FaqEn from "@/app/en/faq/page";
import AboutFr from "@/app/(fr)/a-propos/page";
import AboutEn from "@/app/en/about/page";
import ExampleFr from "@/app/(fr)/exemple-rapport/page";
import ExampleEn from "@/app/en/example-report/page";
import ChecklistFr from "@/app/(fr)/guides/checklist-audit-site-web/page";
import ChecklistEn from "@/app/en/guides/website-audit-checklist/page";
import MethodFr from "@/app/(fr)/methodologie-score/page";
import MethodEn from "@/app/en/scoring-method/page";
import TechnicalFr from "@/app/(fr)/ressources/audit-technique-gratuit/page";
import TechnicalEn from "@/app/en/resources/free-technical-audit/page";
import AccessibilityFr from "@/app/(fr)/ressources/accessibilite-numerique/page";
import AccessibilityEn from "@/app/en/resources/digital-accessibility/page";
import BusinessFr from "@/app/(fr)/ressources/audit-site-pme/page";
import BusinessEn from "@/app/en/resources/small-business-website-audit/page";
import EcommerceFr from "@/app/(fr)/ressources/audit-site-ecommerce/page";
import EcommerceEn from "@/app/en/resources/ecommerce-website-audit/page";
import TermsFr from "@/app/(fr)/conditions-utilisation/page";
import TermsEn from "@/app/en/terms-of-use/page";
import PrivacyFr from "@/app/(fr)/confidentialite/page";
import PrivacyEn from "@/app/en/privacy/page";
import LegalFr from "@/app/(fr)/informations-legales/page";
import LegalEn from "@/app/en/legal-information/page";
import LoadingFr from "@/app/(fr)/report/[token]/loading";
import LoadingEn from "@/app/en/report/[token]/loading";
import ErrorFr from "@/app/(fr)/report/[token]/error";
import ErrorEn from "@/app/en/report/[token]/error";
import SpeedFr from "@/app/(fr)/test-vitesse-site-web/page";
import SpeedEn from "@/app/en/website-speed-test/page";
import SeoFr from "@/app/(fr)/analyse-seo-page/page";
import SeoEn from "@/app/en/page-seo-analysis/page";
import HeadersFr from "@/app/(fr)/verifier-entetes-securite/page";
import HeadersEn from "@/app/en/security-header-check/page";
import AccessibilityTestFr from "@/app/(fr)/test-accessibilite-site-web/page";
import AccessibilityTestEn from "@/app/en/website-accessibility-test/page";

// Chrome has its own localized interaction tests; compare page content here.
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

const pages: [string, ComponentType, ComponentType][] = [
  ["/", HomeFr, HomeEn], ["/ressources", ResourcesFr, ResourcesEn], ["/faq", FaqFr, FaqEn],
  ["/a-propos", AboutFr, AboutEn], ["/exemple-rapport", ExampleFr, ExampleEn],
  ["/guides/checklist-audit-site-web", ChecklistFr, ChecklistEn], ["/methodologie-score", MethodFr, MethodEn],
  ["/ressources/audit-technique-gratuit", TechnicalFr, TechnicalEn],
  ["/ressources/accessibilite-numerique", AccessibilityFr, AccessibilityEn],
  ["/ressources/audit-site-pme", BusinessFr, BusinessEn], ["/ressources/audit-site-ecommerce", EcommerceFr, EcommerceEn],
  ["/conditions-utilisation", TermsFr, TermsEn], ["/confidentialite", PrivacyFr, PrivacyEn], ["/informations-legales", LegalFr, LegalEn],
  ["/test-vitesse-site-web", SpeedFr, SpeedEn], ["/analyse-seo-page", SeoFr, SeoEn],
  ["/verifier-entetes-securite", HeadersFr, HeadersEn], ["/test-accessibilite-site-web", AccessibilityTestFr, AccessibilityTestEn],
];

function renderPage(Page: ComponentType, lang: Lang) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<LangProvider initialLang={lang}><Page /></LangProvider>);
  return root;
}

// Compare structure, styles, anchors and link behaviour, ignoring translated text.
function presentation(root: Element) {
  return Array.from(root.querySelectorAll("*")).map(element => ({
    tag: element.tagName,
    className: element.getAttribute("class"),
    id: element.id,
    labelledBy: element.getAttribute("aria-labelledby"),
    scope: element.getAttribute("scope"),
    target: element.getAttribute("target"),
    rel: element.getAttribute("rel"),
    href: element.getAttribute("href")?.replace(/^[^?#]+/, path => frenchPath(path)),
  }));
}

describe("French and English presentation parity", () => {
  for (const [route, Fr, En] of pages) {
    it(`shares markup and style classes for ${route}`, () => {
      const fr = renderPage(Fr, "fr"), en = renderPage(En, "en");
      expect(presentation(en)).toEqual(presentation(fr));
      expect(fr.querySelectorAll("h1")).toHaveLength(1);
      expect(en.querySelectorAll("h1")).toHaveLength(1);
      expect(en.querySelector("h1")?.textContent).not.toBe(fr.querySelector("h1")?.textContent);
    });
  }

  it("localizes methodology content and destinations while keeping rich text shared", () => {
    for (const [lang, Page] of [["fr", MethodFr], ["en", MethodEn]] as const) {
      const root = renderPage(Page, lang);
      expect(root.querySelector("main")?.getAttribute("lang")).toBe(lang);
      expect(root.querySelectorAll('#domaines article')).toHaveLength(4);
      expect(root.querySelectorAll('#exemple article')).toHaveLength(4);
      expect(root.querySelectorAll("table tbody tr")).toHaveLength(4);
      expect(root.querySelectorAll("em")).toHaveLength(1);
      expect(root.querySelector('a[href="' + localizedPath("/#audit", lang) + '"]')).not.toBeNull();
      expect(root.querySelector('a[href="' + localizedPath("/exemple-rapport", lang) + '"]')).not.toBeNull();
      expect(root.querySelectorAll('a[target="_blank"][rel="noopener noreferrer"]')).toHaveLength(3);
    }
  });

  it("keeps all resource cards and their English destinations", () => {
    const root = renderPage(ResourcesEn, "en");
    for (const href of [
      "/test-accessibilite-site-web", "/verifier-entetes-securite", "/analyse-seo-page", "/test-vitesse-site-web",
      "/exemple-rapport", "/guides/checklist-audit-site-web", "/methodologie-score",
      "/ressources/audit-technique-gratuit", "/ressources/accessibilite-numerique",
      "/ressources/audit-site-pme", "/ressources/audit-site-ecommerce",
      "/ressources/audit-wordpress", "/ressources/audit-shopify", "/ressources/pourquoi-mon-site-ne-convertit-pas",
    ]) {
      const link = root.querySelector(`article a[href="${localizedPath(href, "en")}"]`);
      expect(link).not.toBeNull();
      expect(link?.closest("article")?.textContent).not.toContain(" · French");
    }
  });

  it("shares the report loading and error components", () => {
    expect(LoadingEn).toBe(LoadingFr);
    expect(ErrorEn).toBe(ErrorFr);
  });
});
