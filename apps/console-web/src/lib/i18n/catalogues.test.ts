import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { locales } from "./locales";
import source from "./catalogues/source.json";
import english from "./catalogues/en.json";
import emergency from "./emergency.json";

const placeholders = (text: string) => [...text.matchAll(/\{[\w.]+\}/g)].map(match => match[0]).sort();
// Literal directives, product names and multi-part standard versions must remain
// identifiable in prose, just as the protected code examples do.
const technicalTerms = /https?:\/\/[^\s<>"')]+|\b\d+\.\d+\.\d+\b|\b(?:Argos|Lighthouse|WordPress|Shopify|WooCommerce|Cloudflare|RGAA|WCAG|CSP|HSTS|TLS|SSL|LCP|FCP|CLS|TTI|TBT|OWASP|PHP|EAA|includeSubDomains|Content-Security-Policy(?:-Report-Only)?|Strict-Transport-Security|max-age|unsafe-inline|script-src|style-src|frame-ancestors|aria-label|hreflang|robots\.txt|noindex|nofollow|Report-Only)\b/g;
describe("packaged product translations", () => {
  it("has an English translation for every formerly French-only guide and download", () => {
    for (const key of source.fr) expect((english as Record<string, string>)[key], key).toBeTruthy();
  });
  it.each(locales)("ships a complete emergency screen in $name without the main provider", ({ code }) => {
    expect(emergency[code]).toHaveLength(4);
    for (const text of emergency[code]) expect(text.trim()).not.toBe("");
  });
  it.each(locales.filter(locale => !["fr", "en"].includes(locale.code)))("has complete copy and intact interpolation in $name", ({ code }) => {
    const messages = JSON.parse(readFileSync(new URL(`./catalogues/${code}.json`, import.meta.url), "utf8")) as Record<string, string>;
    for (const key of [...source.en, ...source.fr]) {
      expect(messages[key]?.trim(), `${code}: ${key}`).toBeTruthy();
      expect(placeholders(messages[key]), `${code}: ${key}`).toEqual(placeholders(key));
      expect(messages[key], `${code}: ${key}`).not.toMatch(/ZXQ|QXZ|\{X\d+\}|\uFFFD/);
      const reference = (english as Record<string, string>)[key] ?? key;
      for (const term of reference.match(technicalTerms) ?? []) expect(messages[key], `${code}: ${key}`).toContain(term);
    }
  });
});
