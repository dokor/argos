import type { Report } from "@/components/report/types";

const metrics = [
  { label: "LCP", key: "lighthouse.audit.largest-contentful-paint", unit: "ms" },
  { label: "FCP", key: "lighthouse.audit.first-contentful-paint", unit: "ms" },
  { label: "CLS", key: "lighthouse.audit.cumulative-layout-shift", unit: "unitless" },
  { label: "TBT", key: "lighthouse.audit.total-blocking-time", unit: "ms" },
  { label: "bytes", key: "runtime.network.bytes_estimated", unit: "bytes" },
  { label: "requests", key: "runtime.network.request_count", unit: "count" },
] as const;

/** A Lighthouse score or textual evidence is never a duration. Historical reports may omit passing metrics. */
export function diagnosticMeasurements(report: Report) {
  return metrics.map(metric => {
    const issue = report.issues.find(issue => issue.id === metric.key);
    const evidence = issue?.structuredEvidence, measurement = evidence?.measurement;
    const state = report.scores.coverage?.checks.find(check => check.key === metric.key)?.state;
    const value = (!state || state === "MEASURED") && measurement?.unit === metric.unit
      && Number.isFinite(measurement.value) && measurement.value >= 0 ? measurement.value : undefined;
    return { ...metric, value, source: evidence?.source };
  });
}
