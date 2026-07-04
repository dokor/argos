import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Garde la section login (issue #125 — i18n de la page login) contre la dérive
// fr/en et les copies vides. Consommée par src/app/login/page.tsx.

const REQUIRED_KEYS = [
  "title",
  "passwordLabel",
  "passwordPlaceholder",
  "submit",
  "submitting",
  "error",
] as const;

const locales = { fr, en } as const;

describe("login i18n", () => {
  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      it("defines every required login key with non-empty copy", () => {
        for (const key of REQUIRED_KEYS) {
          const value = (dict.login as Record<string, string>)[key];
          expect(typeof value, `login.${key} in ${name}`).toBe("string");
          expect(value.trim(), `login.${key} in ${name}`).not.toBe("");
        }
      });
    });
  }

  it("exposes the same set of login keys in both locales", () => {
    expect(Object.keys(fr.login).sort()).toEqual(Object.keys(en.login).sort());
  });
});
