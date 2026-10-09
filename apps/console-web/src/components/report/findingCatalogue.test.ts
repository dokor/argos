import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { cleanEvidence, findingContent, supportedFindingKeys } from "./findingCatalogue";
import type { Issue } from "./types";
const issue: Issue = { id: "lighthouse.audit.largest-contentful-paint", severity: "critical", title: "Largest Contentful Paint", impact: "Largest Contentful Paint", recommendation: "" };
describe("versioned bilingual content", () => {
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
