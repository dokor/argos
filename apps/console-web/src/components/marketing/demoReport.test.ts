import { describe, expect, it } from "vitest";
import { demoReport } from "./reportDemoFixture";
import { buildReportModel } from "@/components/report/reportModel";
describe("public illustrative fixture", () => {
  for (const lang of ["fr", "en"] as const) for (const partial of [false, true]) {
    it(`${lang} / partial=${partial}: resolves priorities and coverage honestly`, () => {
      const report = demoReport(lang, partial), model = buildReportModel(report);
      expect(model.counts.total).toBe(3);
      expect(model.counts.important).toBe(2);
      expect(model.counts.opportunity).toBe(1);
      expect(model.priorities.every(priority => priority.findings.length === 1)).toBe(true);
      expect(report.scores.coverage?.provisional).toBe(partial);
      expect(report.scores.coverage?.global.ratio).toBe(partial ? 0.5 : 1);
      expect(JSON.stringify(report)).not.toContain("/report/");
      expect(report.url).toContain(".example/");
    });
  }
});

