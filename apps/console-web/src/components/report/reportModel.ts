import type { Issue, PriorityItem, Report } from "./types";

export const BUSINESS_DOMAINS = ["performance", "security", "seo", "a11y"] as const;
export type BusinessDomain = typeof BUSINESS_DOMAINS[number];
export type FindingDomain = BusinessDomain | "unknown";
export type Finding = {
  key: string;
  anchor: string;
  domain: FindingDomain;
  issue: Issue;
  sources: string[];
};
export type FindingSelection = { key: string; request: number };

function businessDomain(key?: string | null): BusinessDomain | undefined {
  return BUSINESS_DOMAINS.find(domain => domain === key);
}

/** Explicit business metadata only; an engine name is never a domain. */
function findingDomain(issue: Issue): FindingDomain {
  return businessDomain(issue.categoryKey)
    ?? issue.categoryKeys?.map(businessDomain).find(Boolean)
    ?? issue.tags?.map(businessDomain).find(Boolean)
    ?? "unknown";
}

function sources(issue: Issue): string[] {
  return [issue.module, issue.categoryKey, ...(issue.categoryKeys ?? []), ...(issue.tags ?? [])]
    .filter((key): key is string => !!key && !businessDomain(key));
}

/** A pure read model: never changes the stored report, severity, rank or scores. */
export function buildReportModel(report: Report) {
  const byKey = new Map<string, Finding>();
  const byId = new Map<string, Finding>();
  const usedKeys = new Set((report.issues ?? []).map(issue => issue.id).filter(Boolean));
  for (const [index, issue] of (report.issues ?? []).entries()) {
    let key = issue.id;
    if (!key) {
      key = `legacy-row-${index}`;
      while (usedKeys.has(key)) key = `_${key}`;
      usedKeys.add(key);
    }
    const existing = byKey.get(key);
    if (existing) {
      existing.sources = [...new Set([...existing.sources, ...sources(issue)])];
      continue;
    }
    const finding: Finding = {
      key, anchor: `finding-${Array.from(key).map(char => char.codePointAt(0)!.toString(16)).join("-")}`, domain: findingDomain(issue),
      issue, sources: [...new Set(sources(issue))],
    };
    byKey.set(key, finding);
    if (issue.id) byId.set(issue.id, finding);
  }
  const findings = [...byKey.values()];
  const groups = [...BUSINESS_DOMAINS, "unknown" as const].map(key => ({
    key,
    findings: findings.filter(finding => finding.domain === key),
    // Keep the original score. Missing domains have no invented zero score.
    score: key === "unknown" ? undefined : report.scores.byCategory?.find(score => score.key === key),
  }));
  const counts = {
    total: findings.length,
    critical: findings.filter(finding => finding.issue.severity === "critical").length,
    important: findings.filter(finding => finding.issue.severity === "important").length,
    opportunity: findings.filter(finding => finding.issue.severity === "info").length,
  };
  const priorities = (report.summary?.priorities ?? []).map(priority => resolvePriority(priority, byId));
  return { findings, groups, counts, priorities };
}

function resolvePriority(priority: PriorityItem, byKey: Map<string, Finding>) {
  const keys = [...new Set([priority.findingKey, ...(priority.relatedFindingKeys ?? [])]
    .filter((key): key is string => typeof key === "string" && key.length > 0))];
  const findings = keys.flatMap(key => byKey.has(key) ? [byKey.get(key)!] : []);
  return {
    priority, findings,
    status: findings.length === 0 ? "unavailable" as const
      : findings.length < keys.length ? "partial" as const : "resolved" as const,
  };
}

export type ReportModel = ReturnType<typeof buildReportModel>;
