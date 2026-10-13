import { describe, it, expect } from "vitest";
import { demoReport } from "@/components/marketing/reportDemoFixture";
import { scoreLimit } from "./reportInterpretation";
import { buildReportModel } from "./reportModel";
describe("score, severity and coverage interpretation", () => {
  for (const lang of ["fr", "en"] as const) it("explains a limited domain despite sufficient global coverage " + lang, () => {
    const report = demoReport(lang); report.scores.global = 94;
    report.scores.coverage!.global.ratio = .95;
    const a11y = report.scores.coverage!.domains.find(d => d.key === "a11y")!;
    a11y.ratio = .4; a11y.sufficient = false; report.scores.coverage!.provisional = true;
    report.issues[0].severity = "critical";
    const before = JSON.stringify(report);
    expect(scoreLimit(report, lang)).toContain(lang === "fr" ? "accessibilité" : "accessibility");
    expect(scoreLimit(report, lang)).toContain(lang === "fr" ? "globale est suffisante" : "overall coverage is sufficient");
    expect(buildReportModel(report).counts.critical).toBe(1);
    expect(JSON.stringify(report)).toBe(before);
  });
  it("keeps absence of measurements unavailable", () => {
    const report = demoReport("fr", true); report.scores.globalAvailable = false;
    report.scores.coverage!.global.available = false;
    expect(scoreLimit(report, "fr")).toContain("contrôles mesurés");
    expect(report.scores.globalAvailable).toBe(false);
  });
});
