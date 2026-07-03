import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Guards the FAQ page (issue #57) against fr/en translation drift and empty copy.
// The FAQPage JSON-LD and the rendered accordion both rely on this structure.

type FaqItem = { q: string; a: string };
type FaqCategory = { title: string; items: FaqItem[] };

const locales = { fr, en } as const;

describe("faq i18n", () => {
  it("exposes a nav label in both locales", () => {
    expect(fr.nav.faq).toBeTruthy();
    expect(en.nav.faq).toBeTruthy();
  });

  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      it("has hero, meta and stillQuestions copy", () => {
        expect(dict.faq.meta.title).toBeTruthy();
        expect(dict.faq.meta.description).toBeTruthy();
        expect(dict.faq.hero.title).toBeTruthy();
        expect(dict.faq.backHome).toBeTruthy();
        expect(dict.faq.stillQuestions.cta).toBeTruthy();
      });

      it("has non-empty questions and answers in every category", () => {
        const categories = dict.faq.categories as FaqCategory[];
        expect(categories.length).toBeGreaterThan(0);
        for (const category of categories) {
          expect(category.title.trim()).not.toBe("");
          expect(category.items.length).toBeGreaterThan(0);
          for (const item of category.items) {
            expect(item.q.trim()).not.toBe("");
            expect(item.a.trim()).not.toBe("");
          }
        }
      });
    });
  }

  it("keeps the same category and question counts across locales", () => {
    const frCats = fr.faq.categories as FaqCategory[];
    const enCats = en.faq.categories as FaqCategory[];
    expect(frCats.length).toBe(enCats.length);
    frCats.forEach((cat, i) => {
      expect(cat.items.length).toBe(enCats[i].items.length);
    });
  });
});
