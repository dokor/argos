import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { cleanEvidence, findingContent, supportedFindingKeys } from "./findingCatalogue";
import type { Issue } from "./types";
const issue: Issue = { id: "lighthouse.audit.largest-contentful-paint", severity: "critical", title: "Largest Contentful Paint", impact: "Largest Contentful Paint", recommendation: "" };
describe("versioned bilingual content", () => {
  it("preserves distinct titles and corrections in shared groups in both languages", () => {
    const keys = ["html.title", "html.meta.description.present", "html.h1.count", "html.social.meta"];
    expect(keys.map(id => findingContent({ ...issue, id }, "fr").title)).toEqual([
      "Le titre de la page est à préciser", "La description de la page est à vérifier", "Le titre principal de la page est à vérifier", "L’aperçu de partage est à préciser",
    ]);
    expect(keys.map(id => findingContent({ ...issue, id }, "en").title)).toEqual([
      "Clarify the page title", "Review the page description", "Review the main page heading", "Clarify the sharing preview",
    ]);
    for (const lang of ["fr", "en"] as const) {
      expect(new Set(keys.map(id => findingContent({ ...issue, id }, lang).recommendation)).size).toBe(4);
      expect(new Set(["runtime.network.5xx", "runtime.network.failed_requests", "runtime.network.third_party_errors"].map(id => findingContent({ ...issue, id }, lang).title)).size).toBe(3);
    }
  });
  it("uses actual measurements, preserves absent locations and separates tool signals", () => {
    expect(findingContent({ ...issue, id: "html.title", structuredEvidence: { source: "html", details: [{ key: "length", text: "3" }] } }, "fr").observation).toBe("Le titre HTML contient 3 caractères.");
    expect(findingContent({ ...issue, id: "html.meta.description.present", structuredEvidence: { source: "html", details: [{ key: "state", text: "EMPTY" }] } }, "en").observation).toBe("Description in the received HTML : empty value.");
    const measured = { ...issue, id: "runtime.network.failed_requests", structuredEvidence: { source: "runtime", measurement: { value: 3, unit: "count" as const } } };
    const content = findingContent(measured, "fr");
    expect(content.observation).toBe("Requêtes en échec observées — 3 élément(s)");
    expect(content.missingInformation).toContain("ne conserve pas les éléments");
    expect(findingContent({ ...measured, evidence: "https://user:password@example.com/a?token=private" }, "fr").missingInformation).toBe("");
    expect(findingContent({ ...issue, id: "lighthouse.score.performance", confidence: "HIGH" }, "fr").qualification).toBe("Diagnostic agrégé d’outil");
    expect(findingContent({ ...issue, confidence: "HIGH" }, "fr").qualification).toContain("Signal à vérifier");
    expect(findingContent({ ...issue, id: "future.check", title: "An English diagnostic", impact: "An English diagnostic" }, "fr").impact).not.toContain("English");
  });
  it("has four distinct editorial fields for every supported key and preserves technical identity", () => {
    for (const key of supportedFindingKeys) for (const lang of ["fr", "en"] as const) {
      const content = findingContent({ ...issue, id: key }, lang);
      expect(new Set([content.observation, content.impact, content.recommendation, content.verification]).size).toBe(4);
      expect(content.title.length).toBeGreaterThan(5);
    }
    expect(issue.title).toBe("Largest Contentful Paint");
    expect(findingContent(issue, "en").title).toBe("Review when the main content appears");
  });
  it("covers static site checks emitted by the current analyzers", () => {
    for (const id of ["unused-css-rules", "document-title", "meta-description", "errors-in-console", "is-on-https", "redirects-http", "http-status-code", "doctype", "charset", "meta-viewport", "input-image-alt", "svg-img-alt", "image-size-responsive", "interaction-to-next-paint", "inp-breakdown-insight"]) {
      expect(supportedFindingKeys).toContain("lighthouse.audit." + id);
      expect(findingContent({ ...issue, id: "lighthouse.audit." + id }, "fr").title).not.toBe("Contrôle technique à examiner");
    }
    const root = new URL("../../../../api-backend/src/main/java/com/dokor/argos/services/analysis/modules/", import.meta.url);
    const files = readdirSync(root, { recursive: true }).filter(name => String(name).endsWith("Analyzer.java"));
    const keys = files.flatMap(name => [...readFileSync(new URL(String(name).replaceAll("\\", "/"), root), "utf8").matchAll(/"((?:http|html|runtime|ssl|observatory|zap)\.[a-z0-9_.-]+)"/g)].map(match => match[1]));
    const informational = ["observatory.grade", "observatory.tests.passed", "zap.scan.result", "zap.alert."];
    expect([...new Set(keys)].filter(key => !informational.includes(key) && !supportedFindingKeys.includes(key))).toEqual([]);
  });
  it("has readable legacy/unknown fallbacks and confirms unknown confidence before prescribing", () => {
    const unknown = findingContent({ ...issue, id: "future.check", confidence: "UNKNOWN" }, "en");
    expect(unknown.title).toBe(issue.title);
    expect(unknown.recommendation).toContain("Confirm the signal");
    expect(findingContent({ ...issue, confidence: "HIGH" }, "en").recommendation).not.toContain("Confirm the signal");
  });
  it("bounds text and strips controls and credentials from third-party URLs", () => {
    expect(cleanEvidence("x".repeat(5000))).toHaveLength(4000);
    expect(cleanEvidence("\u0001https://user:secret@example.com/page?token=private#fragment")).toBe("https://example.com/page");
  });
});

for (const lang of ["fr", "en"] as const) it(`does not repeat the confirmation when guidance is missing in ${lang}`, () => {
  const text = findingContent({ ...issue, id: "future.check", recommendation: "", confidence: "UNKNOWN" }, lang).recommendation;
  expect(text.split(lang === "fr" ? "Confirmer le signal" : "Confirm the signal")).toHaveLength(2);
});
