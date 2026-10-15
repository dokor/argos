import { expect, it } from "vitest";
import { diagnosticMeasurements } from "./diagnosticMeasurements";
import type { Report } from "@/components/report/types";
const report = (measurement?: { value: number; unit: "ms" | "ratio" }) => ({ issues: [{ id: "lighthouse.audit.largest-contentful-paint", evidence: "score=0.02, 4.9 seconds", structuredEvidence: { source: "lighthouse", measurement } }], scores: {} }) as Report;
it("uses explicit numeric units, including zero, without parsing scores or historical prose", () => {
  expect(diagnosticMeasurements(report())[0].value).toBeUndefined();
  expect(diagnosticMeasurements(report({ value: .02, unit: "ratio" }))[0].value).toBeUndefined();
  expect(diagnosticMeasurements(report({ value: 0, unit: "ms" }))[0].value).toBe(0);
  expect(diagnosticMeasurements(report({ value: 4900, unit: "ms" }))[0].value).toBe(4900);
  expect(diagnosticMeasurements(report({ value: NaN, unit: "ms" }))[0].value).toBeUndefined();
});
it("does not show a measurement blocked by coverage or substitute a missing passing metric", () => {
  const value = report({ value: 4900, unit: "ms" });
  value.scores.coverage = { checks: [{ key: "lighthouse.audit.largest-contentful-paint", state: "UNAVAILABLE" }] } as NonNullable<Report["scores"]["coverage"]>;
  expect(diagnosticMeasurements(value).every(metric => metric.value === undefined)).toBe(true);
});
