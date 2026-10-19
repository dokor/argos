import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { exampleTtcCents, premiumPriceLabels, premiumPricing } from "./premium-pricing";

it("keeps public EUR prices consistent with backend configuration while launch gates remain closed", () => {
  const reference = readFileSync(new URL("../../../api-backend/src/main/resources/reference.conf", import.meta.url), "utf8");
  expect(reference).toMatch(new RegExp(`monthly-amount-ht-cents = ${premiumPricing.monthlyAmountHtCents}\\b`));
  expect(reference).toMatch(new RegExp(`annual-amount-ht-cents = ${premiumPricing.annualAmountHtCents}\\b`));
  for (const gate of ["enabled", "payments-enabled", "prices-approved", "launch-approved", "tax-ready", "premium-priority-enabled"])
    expect(reference).toMatch(new RegExp(`\\b${gate} = false`));
});

it("calculates the approved annual saving and illustrative TTC without treating VAT as universal", () => {
  expect(exampleTtcCents(1900)).toBe(2280); expect(exampleTtcCents(19900)).toBe(23880);
  expect(premiumPriceLabels("en")).toMatchObject({ monthly: "€19", annual: "€199", saving: "€29", discount: "12.7%", annualTtc: "€238.80" });
  expect(premiumPriceLabels("fr").discount).toMatch(/12,7/);
});
