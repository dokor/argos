import { describe, expect, it } from "vitest";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import historical from "./fixtures/historical-report.json";
import { buildReportAiPrompt } from "./buildAiCorrectionPrompt";
import { buildReportModel } from "./reportModel";
import type { Report } from "./types";

const report = historical as Report;
function dataFor(value: Report, lang: "fr" | "en" = "fr") {
  const copy = (lang === "fr" ? fr : en).report.aiPrompt;
  return JSON.parse(buildReportAiPrompt(value, lang).split(copy.promptData + "\n\n")[1].split("\n\n" + copy.promptEnd)[0]);
}

describe("report correction prompt", () => {
  it.each(["fr", "en"] as const)("includes every canonical finding, guidance and priority in %s", lang => {
    const original = JSON.stringify(report);
    const data = dataFor(report, lang);
    expect(data.findings.map((item: { key: string }) => item.key)).toEqual(buildReportModel(report).findings.map(item => item.key));
    expect(data.priorities.map((item: { title: string }) => item.title)).toEqual(report.summary.priorities.map(item => item.title));
    expect(data.findings[0]).toMatchObject({ evidence: report.issues[0].evidence ?? null, original: { title: report.issues[0].title } });
    expect(data.findings.every((item: { steps: string[]; verification: string }) => item.steps.length && item.verification.length)).toBe(true);
    expect(buildReportAiPrompt(report, lang)).toContain((lang === "fr" ? fr : en).report.aiPrompt.promptLimits);
    expect(JSON.stringify(report)).toBe(original);
  });

  it("deduplicates canonical IDs without losing historical findings without IDs", () => {
    const issue = { ...report.issues[0], id: "custom.check" };
    const value = { ...report, issues: [issue, issue, { ...issue, id: null }, { ...issue, id: null }] };
    expect(dataFor(value).findings).toHaveLength(3);
  });

  it("keeps measured evidence, locations and scoped audit limitations", () => {
    const value: Report = { ...report, scores: { ...report.scores, scope: {
      kind: "check", target: "custom.check", executedModules: ["runtime"], newCheckKeys: ["custom.check"], reusedCheckKeys: ["html.title"],
    } }, issues: [{ ...report.issues[0], structuredEvidence: {
      source: "runtime", measurement: { value: 4500, unit: "ms" },
      observed: { version: "observed-evidence-v1", source: "runtime", state: "AVAILABLE", inspected: 2, truncated: true, redacted: true,
        items: [{ kind: "element", nodePath: "main > img" }] },
    } }] };
    expect(dataFor(value)).toMatchObject({ partial: true, scope: { reusedCheckKeys: ["html.title"] }, findings: [{
      structuredEvidence: { measurement: { value: 4500, unit: "ms" }, observed: { truncated: true, items: [{ nodePath: "main > img" }] } },
    }] });
  });

  it("exports unavailable scores as null, not zero, and explains empty findings", () => {
    const value: Report = { ...report, issues: [], antiBot: { detected: true }, scores: {
      ...report.scores, global: 0, globalAvailable: false, completeness: 0,
      coverage: { version: "test", threshold: 0.8, provisional: true,
        global: { key: "global", measuredWeight: 0, expectedWeight: 1, ratio: 0, available: false, sufficient: false },
        domains: [{ key: "security", measuredWeight: 0, expectedWeight: 1, ratio: 0, available: false, sufficient: false }],
        checks: [{ key: "http.security.csp", domain: "security", module: "http", weight: 1, state: "BLOCKED_BY_ANTIBOT", reason: "challenge", confidence: "LOW" }],
      },
    } };
    const data = dataFor(value);
    expect(data.scores.global).toBeNull();
    expect(data.scores.domains.find((item: { domain: string }) => item.domain === "security").score).toBeNull();
    expect(data.coverage.unmeasuredChecks[0].state).toBe("BLOCKED_BY_ANTIBOT");
    expect(data.partial).toBe(true);
    expect(buildReportAiPrompt(value, "en")).toContain(en.report.aiPrompt.promptEmpty);
    expect(dataFor({ ...report, scores: { ...report.scores, coverage: null } }).coverage).toBeNull();
  });

  it("redacts URLs, credentials and private report links in nested evidence", () => {
    const secret = "private_token_12345678901234567890";
    const value: Report = { ...report,
      url: "https://user:password@example.test/page?api_key=hidden#secret",
      issues: [{ ...report.issues[0], evidence: `https://argos.test/report/${secret}\nAuthorization: Bearer hidden`,
        structuredEvidence: { source: "runtime", details: [{ key: "url", text: `https://user:password@example.test/image?token=${secret}\ntoken=${secret}` }] } }],
    };
    const prompt = buildReportAiPrompt(value, "fr");
    expect(dataFor(value).requestedPage).toBe("https://example.test/page");
    expect(prompt).not.toContain(secret);
    expect(prompt).not.toContain("user:password");
    expect(prompt).not.toContain("Bearer hidden");
    expect(prompt).not.toContain("api_key=hidden");
  });

  it("never exports technical details from a locked summary", () => {
    expect(buildReportAiPrompt({ ...report, access: "summary" }, "fr")).toBe("");
  });
});
