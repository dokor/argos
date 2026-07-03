import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Guards the 404 page (issue #95) against fr/en translation drift and empty copy.
// not-found.tsx renders these keys client-side via useLang().

const locales = { fr, en } as const;

describe("notFound i18n", () => {
  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      it("has non-empty badge, title, sub and both CTAs", () => {
        expect(dict.notFound.badge.trim()).not.toBe("");
        expect(dict.notFound.title.trim()).not.toBe("");
        expect(dict.notFound.sub.trim()).not.toBe("");
        expect(dict.notFound.homeCta.trim()).not.toBe("");
        expect(dict.notFound.faqCta.trim()).not.toBe("");
      });
    });
  }

  it("exposes the same keys across locales", () => {
    expect(Object.keys(fr.notFound).sort()).toEqual(Object.keys(en.notFound).sort());
  });
});
