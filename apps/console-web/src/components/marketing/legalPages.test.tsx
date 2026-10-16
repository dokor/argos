// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { siteUrl } from "@/lib/i18n/metadata";
import LangToggle from "@/components/LangToggle";
import TermsPage, { metadata as termsFr } from "@/app/(fr)/conditions-utilisation/page";
import { metadata as termsEn } from "@/app/en/terms-of-use/page";
import PrivacyPage, { metadata as privacyFr } from "@/app/(fr)/confidentialite/page";
import { metadata as privacyEn } from "@/app/en/privacy/page";
import LegalPage, { metadata as legalFr } from "@/app/(fr)/informations-legales/page";
import { metadata as legalEn } from "@/app/en/legal-information/page";

const route = vi.hoisted(() => ({ path: "/conditions-utilisation" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("@/components/site/SiteNav", () => ({ default: () => null }));
vi.mock("@/components/site/SiteFooter", () => ({ default: () => null }));

const pages = [
  { Component: TermsPage, path: "/conditions-utilisation", enPath: "/en/terms-of-use", fr: termsFr, en: termsEn, titles: { fr: "Conditions d’utilisation d’Argos", en: "Argos terms of use" }, sections: 7 },
  { Component: PrivacyPage, path: "/confidentialite", enPath: "/en/privacy", fr: privacyFr, en: privacyEn, titles: { fr: "Confidentialité et accès aux rapports Argos", en: "Privacy and access to Argos reports" }, sections: 17 },
  { Component: LegalPage, path: "/informations-legales", enPath: "/en/legal-information", fr: legalFr, en: legalEn, titles: { fr: "Informations sur le service Argos", en: "Argos service information" }, sections: 4 },
];

describe("public legal pages in both languages", () => {
  for (const page of pages) {
    it.each(["fr", "en"] as const)(`renders ${page.path} in %s before hydration with a direct language switch`, lang => {
      route.path = lang === "fr" ? page.path : page.enPath;
      const html = renderToStaticMarkup(<LangProvider initialLang={lang}><page.Component /><LangToggle /></LangProvider>);
      expect(html).toContain(`<h1>${page.titles[lang]}</h1>`);
      expect(html).toContain(`lang="${lang}"`);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html.match(/<h2(?:>| )/g)).toHaveLength(page.sections);
      if (page.Component !== TermsPage) {
        const document = new DOMParser().parseFromString(html, "text/html");
        for (const link of document.querySelectorAll('main nav a')) {
          const target = document.querySelector(link.getAttribute('href')!);
          expect(target?.tagName).toBe('SECTION');
          expect(target?.getAttribute('aria-labelledby')).toBeTruthy();
        }
      }
      expect(html).toContain('href="' + page.path + '"');
      expect(html).toContain('href="' + page.enPath + '"');
      expect(html).toContain('href="mailto:');
      expect(html).not.toContain("English guides — this page is available in French only");
    });

    it(`publishes reciprocal metadata for ${page.path} and preserves link suffixes`, () => {
      const languages = { fr: siteUrl + page.path, en: siteUrl + page.enPath, "x-default": siteUrl + page.path };
      expect(page.fr.alternates).toEqual({ canonical: languages.fr, languages });
      expect(page.en.alternates).toEqual({ canonical: languages.en, languages });
      expect(page.en.openGraph?.url).toBe(languages.en);
      expect(localizedPath(page.path + "?source=login#details", "en")).toBe(page.enPath + "?source=login#details");
      expect(localizedPath(page.enPath + "#details", "fr")).toBe(page.path + "#details");
    });
  }

  it("keeps privacy commitments and related links available in English without signing in", () => {
    const html = renderToStaticMarkup(<LangProvider initialLang="en"><PrivacyPage /></LangProvider>);
    for (const text of ["Argon2id", "HttpOnly", "15 minutes", "12 hours", "30-minute", "three years", "batches of 500", "90 days", "Belgium", "OVH", "Cloudflare Turnstile", "read:user", "user:email", "openid", "Gmail, Google Drive", "not retained", "Manage cookies", "separately from product measurement", "Account notifications", "Detailed findings require a verified account", "Antoine Le Louët EI"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('href="/en/terms-of-use"');
    expect(html).toContain('href="/en/legal-information"');
    expect(html).not.toContain('href="/conditions-utilisation"');
    expect(html).not.toContain('href="/informations-legales"');
    const terms = renderToStaticMarkup(<LangProvider initialLang="en"><TermsPage /></LangProvider>);
    expect(terms).toContain('href="/en/privacy"');
    expect(terms).toContain('href="/en/scoring-method"');
  });

  it.each(["fr", "en"] as const)("publishes confirmed operator facts consistently in %s", lang => {
    const privacy = renderToStaticMarkup(<LangProvider initialLang={lang}><PrivacyPage /></LangProvider>);
    const legal = renderToStaticMarkup(<LangProvider initialLang={lang}><LegalPage /></LangProvider>);
    for (const html of [privacy, legal]) {
      for (const text of ["Antoine Le Louët EI", "OVH", "Google", "GitHub", "LinkedIn", lang === "fr" ? "Belgique" : "Belgium", lang === "fr" ? "trois ans" : "three years"]) expect(html).toContain(text);
      expect(html).not.toContain("Backup retention has not been confirmed");
      expect(html).not.toContain("durée des sauvegardes n’a pas été confirmée");
    }
  });
});

