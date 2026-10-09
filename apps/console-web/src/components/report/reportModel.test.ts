import { describe, expect, it } from "vitest";
import historical from "./fixtures/historical-report.json";
import { buildReportModel } from "./reportModel";
import type { Report } from "./types";

const historicalReport = historical as Report;

describe("shared report model", () => {
  it("reproduces the old renderer's omissions and duplicate groups without changing the stored score", () => {
    const stored = structuredClone(historicalReport);
    // Old renderer: only score categories, every categoryKeys membership, raw rows in hero.
    const oldVisible = stored.scores.byCategory.reduce((sum, category) => sum + stored.issues.filter(issue =>
      (issue.categoryKeys?.length ? issue.categoryKeys : [issue.categoryKey]).includes(category.key)).length, 0);
    expect(oldVisible).toBe(5);
    expect(stored.issues).toHaveLength(7);
    const model = buildReportModel(stored);
    expect(model.counts).toEqual({ total: 6, critical: 2, important: 2, opportunity: 2 });
    expect(model.groups.map(group => group.findings.length)).toEqual([2, 1, 0, 1, 2]);
    expect(model.groups.reduce((sum, group) => sum + group.findings.length, 0)).toBe(model.counts.total);
    expect(stored).toEqual(historicalReport);
    expect(model.groups.find(group => group.key === "a11y")?.score?.score).toBe(65);
  });

  it("retains tool provenance, takes the first row for duplicate ids, and assigns one explicit business domain", () => {
    const model = buildReportModel(historicalReport);
    expect(model.findings.find(finding => finding.key === "runtime.load")).toMatchObject({
      domain: "performance", sources: ["runtime", "lighthouse"],
    });
    const report = { ...historicalReport, issues: [
      { ...historicalReport.issues[0], categoryKey: "seo", categoryKeys: ["performance", "security"] },
      { ...historicalReport.issues[0], categoryKey: "a11y", severity: "critical" as const },
    ] };
    expect(buildReportModel(report).findings[0]).toMatchObject({ domain: "seo", issue: { severity: "important" } });
  });

  it("resolves grouped priorities by exact keys only, deduplicates links and reports absent members", () => {
    const model = buildReportModel(historicalReport);
    expect(model.priorities[0]).toMatchObject({ status: "unavailable", findings: [] });
    expect(model.priorities[1].status).toBe("partial");
    expect(model.priorities[1].findings.map(finding => finding.key)).toEqual(["runtime.load", "lighthouse.lcp"]);
  });

  it("keeps every row without an id and never resolves a priority via synthetic keys or titles", () => {
    const issue = { ...historicalReport.issues[0], id: undefined };
    const report = { ...historicalReport, issues: [issue, issue, { ...issue, id: "legacy-row-0" }] };
    const model = buildReportModel(report);
    expect(model.counts.total).toBe(3);
    expect(new Set(model.findings.map(finding => finding.anchor)).size).toBe(3);
    const linked = buildReportModel({ ...report, summary: { oneLiner: "good", priorities: [
      { severity: "important", title: issue.title, impact: "Context", findingKey: model.findings[0].key },
    ] } });
    expect(linked.priorities[0].status).toBe("unavailable");
  });

  it("keeps findings visible with empty score categories; business tags can supply explicit metadata", () => {
    const report = { ...historicalReport, scores: { ...historicalReport.scores, byCategory: [] },
      issues: [{ ...historicalReport.issues[0], categoryKey: "runtime", categoryKeys: [], tags: ["runtime", "performance"] }] };
    const model = buildReportModel(report);
    expect(model.findings[0].domain).toBe("performance");
    expect(model.groups.every(group => group.score === undefined)).toBe(true);
    expect(model.counts.total).toBe(1);
  });

  it("preserves the current contract's order, severities, exact linkage and empty domains", () => {
    const report = { ...historicalReport, issues: [historicalReport.issues[2]],
      summary: { oneLiner: "good", priorities: [{ severity: "critical" as const, title: "Action", impact: "Context", findingKey: "lighthouse.lcp" }] } };
    const model = buildReportModel(report);
    expect(model.counts).toEqual({ total: 1, critical: 1, important: 0, opportunity: 0 });
    expect(model.priorities[0]).toMatchObject({ status: "resolved", priority: report.summary.priorities[0] });
    expect(model.groups.filter(group => group.findings.length === 0)).toHaveLength(4);
  });

  it("handles a report without findings and can resolve related keys when the primary key is absent", () => {
    const empty = buildReportModel({ ...historicalReport, issues: [] });
    expect(empty.counts).toEqual({ total: 0, critical: 0, important: 0, opportunity: 0 });
    expect(empty.groups.every(group => group.findings.length === 0)).toBe(true);
    expect(empty.priorities.every(priority => priority.status === "unavailable")).toBe(true);
    const related = buildReportModel({ ...historicalReport, summary: { oneLiner: "good", priorities: [
      { severity: "important", title: "Group", impact: "Context", relatedFindingKeys: ["http.hsts", "http.hsts"] },
    ] } });
    expect(related.priorities[0].status).toBe("resolved");
    expect(related.priorities[0].findings.map(finding => finding.key)).toEqual(["http.hsts"]);
  });
});
