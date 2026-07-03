import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Guards the report category explanations (issue #20) against fr/en drift and
// empty copy. ScoreGrid and IssuesByCategory look up report.categoryInfo[key]
// with a mandatory `fallback` for unknown category keys.

const locales = { fr, en } as const;

// Business category keys the backend can emit (PublicReportComposer.pickCategoryKey).
const EXPECTED_KEYS = [
  "fallback",
  "security",
  "ssl",
  "observatory",
  "seo",
  "a11y",
  "performance",
  "runtime",
  "lighthouse",
];

describe("report categoryInfo i18n", () => {
  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      const info = dict.report.categoryInfo as Record<string, string>;

      it("exposes a non-empty fallback", () => {
        expect(info.fallback?.trim()).toBeTruthy();
      });

      it("covers every expected category key with non-empty copy", () => {
        for (const key of EXPECTED_KEYS) {
          expect(info[key]?.trim(), `missing/empty categoryInfo.${key}`).toBeTruthy();
        }
      });
    });
  }

  it("keeps the same category keys across locales", () => {
    const frKeys = Object.keys(fr.report.categoryInfo).sort();
    const enKeys = Object.keys(en.report.categoryInfo).sort();
    expect(frKeys).toEqual(enKeys);
  });
});
