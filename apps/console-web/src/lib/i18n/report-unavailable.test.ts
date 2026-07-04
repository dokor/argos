import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Garde le sous-arbre report.unavailable (issue #63 - page d'erreur des rapports)
// contre la dérive fr/en et les copies vides. Consommé par
// src/components/report/ReportErrorView.tsx.

const STRING_KEYS = ["rerunTitle", "rerunHint", "backHome"] as const;
const KIND_KEYS = ["notFound", "failed"] as const;
const KIND_FIELDS = ["title", "description"] as const;

const locales = { fr, en } as const;

describe("report.unavailable i18n", () => {
  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      const unavailable = dict.report.unavailable as Record<string, unknown>;

      it("defines every scalar key with non-empty copy", () => {
        for (const key of STRING_KEYS) {
          const value = unavailable[key] as string;
          expect(typeof value, `report.unavailable.${key} in ${name}`).toBe("string");
          expect(value.trim(), `report.unavailable.${key} in ${name}`).not.toBe("");
        }
      });

      it("defines title/description for each error kind", () => {
        for (const kind of KIND_KEYS) {
          const block = unavailable[kind] as Record<string, string>;
          expect(block, `report.unavailable.${kind} in ${name}`).toBeTruthy();
          for (const field of KIND_FIELDS) {
            expect(typeof block[field], `report.unavailable.${kind}.${field} in ${name}`).toBe("string");
            expect(block[field].trim(), `report.unavailable.${kind}.${field} in ${name}`).not.toBe("");
          }
        }
      });
    });
  }

  it("exposes the same set of keys in both locales", () => {
    const frU = fr.report.unavailable as Record<string, unknown>;
    const enU = en.report.unavailable as Record<string, unknown>;
    expect(Object.keys(frU).sort()).toEqual(Object.keys(enU).sort());
    for (const kind of KIND_KEYS) {
      expect(Object.keys(frU[kind] as object).sort())
        .toEqual(Object.keys(enU[kind] as object).sort());
    }
  });
});
