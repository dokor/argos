import { expect, it } from "vitest";
import { correctionGuide } from "./correctionGuides";
it("links known published findings through controlled keys without audit data", () => {
  expect(correctionGuide("html.meta.description.present","fr")?.href).toBe("/guides/checklist-audit-site-web#html-seo");
  expect(correctionGuide("html.images.alt_coverage","fr")?.href).toBe("/guides/checklist-audit-site-web#accessibilite");
});
it("omits unknown keys and links the three correction guides in both languages", () => {
  for (const key of [undefined, "__proto__", "constructor", "https://attacker.example", "unknown.finding"]) expect(correctionGuide(key,"fr")).toBeUndefined();
  expect(correctionGuide("html.title","en")?.href).toBe("/en/guides/website-audit-checklist#html-seo");
  expect(correctionGuide("http.security.csp","en")?.href).toBe("/en/guides/content-security-policy");
  expect(correctionGuide("http.security.hsts","fr")?.href).toBe("/guides/hsts");
  expect(correctionGuide("runtime.lcp","fr")?.href).toBe("/guides/lcp-lent");
  expect(correctionGuide("lighthouse.audit.largest-contentful-paint","en")?.href).toBe("/en/guides/slow-lcp");
});
