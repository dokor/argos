import { expect, it } from "vitest";
import { correctionGuide } from "./correctionGuides";
it("links known published findings through controlled keys without audit data", () => {
  expect(correctionGuide("html.meta.description.present","fr")?.href).toBe("/guides/checklist-audit-site-web#html-seo");
  expect(correctionGuide("html.images.alt_coverage","fr")?.href).toBe("/guides/checklist-audit-site-web#accessibilite");
});
it("omits unknown keys, unpublished guides and missing languages", () => {
  for (const key of [undefined, "__proto__", "constructor", "https://attacker.example", "unknown.finding", "http.security.csp", "http.security.hsts", "lighthouse.audit.largest-contentful-paint"]) expect(correctionGuide(key,"fr")).toBeUndefined();
  expect(correctionGuide("html.title","en")?.href).toBe("/en/guides/website-audit-checklist#html-seo");
  expect(correctionGuide("http.security.csp","en")).toBeUndefined();
});
