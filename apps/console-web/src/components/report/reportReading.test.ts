import { describe, expect, it } from "vitest";
import { parseReading, readingUrl, resolveReading } from "./reportReading";
import { buildReportModel } from "./reportModel";
import historical from "./fixtures/historical-report.json";
import type { Report } from "./types";
const model = buildReportModel(historical as Report);
describe("report URL reading", () => {
  it("uses deterministic defaults and whitelists every parameter", () => {
    expect(parseReading("")).toEqual({ view: "overview", domain: "all", severity: "all", anchor: "" });
    expect(parseReading("?view=javascript&domain=runtime&severity=urgent").view).toBe("overview");
    expect(parseReading("?view=technical&domain=unknown&severity=info")).toMatchObject({ view: "technical", domain: "unknown", severity: "info" });
  });
  it("preserves the language, token path and unrelated query parameters", () => {
    expect(readingUrl("/en/report/existing-token?custom=1&domain=security", { view: "actions" })).toBe("/en/report/existing-token?custom=1&domain=security&view=actions");
    expect(readingUrl("/report/existing-token?view=technical&severity=critical#old", { view: "overview", severity: "all", anchor: "" })).toBe("/report/existing-token");
  });
  it("opens an exact finding and lifts incompatible filters; reports an absent anchor", () => {
    const finding = model.findings.find(item => item.key === "runtime.load")!;
    expect(resolveReading(`?domain=security&severity=critical#${finding.anchor}`, model)).toMatchObject({ view: "technical", domain: "all", severity: "all", finding });
    expect(resolveReading("#finding-dead", model).missing).toBe(true);
    expect(resolveReading("#top", model).missing).toBe(false);
  });
});
