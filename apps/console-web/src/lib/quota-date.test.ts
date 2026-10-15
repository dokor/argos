import { afterEach, describe, expect, it, vi } from "vitest";
import { quotaResetDate } from "./quota-date";

afterEach(() => vi.unstubAllEnvs());
describe("renewal date and its displayed timezone", () => {
  for (const browserZone of ["UTC", "Europe/Paris"]) for (const lang of ["fr", "en"] as const) {
    for (const instant of ["2026-07-01T00:00:00Z", "2026-11-01T00:00:00Z"]) {
      it(`${lang}, ${browserZone}, ${instant}: formats the billed zone`, () => {
        vi.stubEnv("TZ", browserZone);
        const date = new Date(instant);
        for (const billingZone of ["UTC", "Europe/Paris"]) {
          const expected = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
            dateStyle: "medium", timeStyle: "short", timeZone: billingZone,
          }).format(date);
          expect(quotaResetDate(instant, lang, billingZone)).toBe(`${expected} · ${billingZone}`);
        }
        expect(quotaResetDate(instant, lang, "UTC")).toContain("00:00");
        expect(quotaResetDate(instant, lang, "Europe/Paris")).toContain(instant.includes("07-01") ? "02:00" : "01:00");
      });
    }
  }
  it("labels its actual fallback zone and tolerates absent dates", () => {
    expect(quotaResetDate("2026-11-01T00:00:00Z", "en", "invalid")).toContain("00:00 · UTC");
    expect(quotaResetDate("invalid", "fr")).toBe("— · UTC");
  });
});
