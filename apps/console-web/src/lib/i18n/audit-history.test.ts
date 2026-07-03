import { describe, expect, it } from "vitest";
import fr from "./fr.json";
import en from "./en.json";

// Guards the dashboard audit-history strings (issue #11) against fr/en drift and
// empty copy. AuditCard reads t.auditList.history for the collapsible history section.

const locales = { fr, en } as const;

const HISTORY_KEYS = ["toggle", "loading", "empty", "error", "current", "view", "scoreNa"];

describe("auditList.history i18n", () => {
  for (const [name, dict] of Object.entries(locales)) {
    describe(name, () => {
      const history = dict.auditList.history as Record<string, string>;

      it("provides every history key with non-empty copy", () => {
        for (const key of HISTORY_KEYS) {
          expect(history[key]?.trim(), `missing/empty auditList.history.${key}`).toBeTruthy();
        }
      });
    });
  }

  it("keeps the same history keys across locales", () => {
    const frKeys = Object.keys(fr.auditList.history).sort();
    const enKeys = Object.keys(en.auditList.history).sort();
    expect(frKeys).toEqual(enKeys);
  });
});
