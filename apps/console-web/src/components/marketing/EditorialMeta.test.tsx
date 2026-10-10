import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LangProvider } from "@/lib/i18n/LangContext";
import { editorialPages } from "@/lib/editorial";
import EditorialMeta from "./EditorialMeta";

describe("editorial dates", () => {
  it("renders the same documented ISO dates in both languages, independent of a build clock", () => {
    for (const lang of ["fr", "en"] as const) {
      const html = renderToStaticMarkup(<LangProvider initialLang={lang}><EditorialMeta route="/methodologie-score" /></LangProvider>);
      expect(html).toContain('dateTime="2026-10-07"'); expect(html).toContain('dateTime="2026-10-10"');
      expect(html).toContain("Antoine Le Louët"); expect(html).toContain('href="#limites"');
      expect(html).toContain(lang === "fr" ? "Lecture estimée" : "Estimated reading");
    }
  });
  it("keeps revisions after first versions and requires references for every published record", () => {
    for (const entry of Object.values(editorialPages)) {
      expect(entry.revised >= entry.firstVersion).toBe(true); expect(entry.minutes).toBeGreaterThan(0);
      expect(entry.sourceUrls.length).toBeGreaterThan(0); expect(entry.sourceUrls.every(url => url.startsWith("https://"))).toBe(true);
    }
  });
});
