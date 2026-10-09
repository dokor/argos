import { useSyncExternalStore } from "react";
import { BUSINESS_DOMAINS, type ReportModel } from "./reportModel";

export const REPORT_VIEWS = ["overview", "actions", "technical"] as const;
export type ReportView = typeof REPORT_VIEWS[number];
export type ReadingState = { view: ReportView; domain: string; severity: string; anchor: string };
export function parseReading(suffix: string): ReadingState {
  const url = new URL(`/report/document${suffix}`, "https://argos.invalid");
  const view = REPORT_VIEWS.find(view => view === url.searchParams.get("view")) ?? "overview";
  const domain = [...BUSINESS_DOMAINS, "unknown"].find(domain => domain === url.searchParams.get("domain")) ?? "all";
  const severity = ["critical", "important", "info"].find(severity => severity === url.searchParams.get("severity")) ?? "all";
  return { view, domain, severity, anchor: url.hash.slice(1) };
}
export function resolveReading(suffix: string, model: ReportModel) {
  const state = parseReading(suffix);
  const finding = model.findings.find(finding => finding.anchor === state.anchor);
  // A direct finding link wins over incompatible filters, including on history restore.
  return finding ? { ...state, view: "technical" as const,
    domain: state.domain === "all" || state.domain === finding.domain ? state.domain : "all",
    severity: state.severity === "all" || state.severity === finding.issue.severity ? state.severity : "all",
    finding, missing: false }
    : { ...state, finding: undefined, missing: state.anchor.startsWith("finding-") };
}
export function readingUrl(current: string, patch: Partial<ReadingState>): string {
  const url = new URL(current, "https://argos.invalid");
  for (const field of ["view", "domain", "severity"] as const) {
    if (patch[field] === undefined) continue;
    if (patch[field] === "all" || patch[field] === "overview") url.searchParams.delete(field);
    else url.searchParams.set(field, patch[field]!);
  }
  if (patch.anchor !== undefined) url.hash = patch.anchor;
  return url.pathname + url.search + url.hash;
}
export function subscribeReading(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  window.addEventListener("argos-reading", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("argos-reading", callback);
  };
}
export const readingSnapshot = () => window.location.search + window.location.hash;
export function useReportReading(model: ReportModel) {
  const suffix = useSyncExternalStore(subscribeReading, readingSnapshot, () => "");
  const state = resolveReading(suffix, model);
  function navigate(patch: Partial<ReadingState>) {
    window.history.pushState(null, "", readingUrl(window.location.href, patch));
    window.dispatchEvent(new Event("argos-reading"));
  }
  return { ...state, navigate, suffix };
}
