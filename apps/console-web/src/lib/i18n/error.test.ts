import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Guards the global error boundary (issue #62) against fr/en drift and empty copy.
// The keys below are consumed by src/app/error.tsx.

const REQUIRED_KEYS = [
  "title",
  "description",
  "retry",
  "backHome",
  "reference",
] as const;

const locales = { fr, en } as const;

describe("error i18n", () => {
  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      it("defines every required error key with non-empty copy", () => {
        for (const key of REQUIRED_KEYS) {
          const value = (dict.error as Record<string, string>)[key];
          expect(typeof value, `error.${key} in ${name}`).toBe("string");
          expect(value.trim(), `error.${key} in ${name}`).not.toBe("");
        }
      });
    });
  }

  it("exposes the same set of error keys in both locales", () => {
    expect(Object.keys(fr.error).sort()).toEqual(Object.keys(en.error).sort());
  });
});
