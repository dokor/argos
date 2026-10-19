/** Approved EUR prices; publishing these amounts never authorizes checkout or CI. */
export const premiumPricing = {
  monthlyAmountHtCents: 1900,
  annualAmountHtCents: 19900,
  exampleVatPercent: 20,
} as const;

export function premiumPriceLabels(lang: string) {
  const money = (cents: number) => new Intl.NumberFormat(lang, {
    style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100);
  const { monthlyAmountHtCents: month, annualAmountHtCents: year } = premiumPricing;
  const percent = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
  return {
    monthly: money(month), annual: money(year), equivalent: money(year / 12),
    saving: money(month * 12 - year), discount: percent.format(1 - year / (month * 12)),
    monthlyTtc: money(month * (1 + premiumPricing.exampleVatPercent / 100)),
    annualTtc: money(year * (1 + premiumPricing.exampleVatPercent / 100)),
  };
}

/** Illustrative only: Stripe remains the authority for the customer's applicable tax. */
export function exampleTtcCents(amountHtCents: number) {
  return Math.round(amountHtCents * (1 + premiumPricing.exampleVatPercent / 100));
}
