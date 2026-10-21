import type { Lang } from "@/lib/i18n/routes";
import fr from "@/lib/i18n/fr.json";
import en from "@/lib/i18n/en.json";
import { cleanEvidence, findingContent } from "./findingCatalogue";
import { findingExplanation } from "./findingExplanation";
import { buildReportModel, type ReportModel } from "./reportModel";
import { domainScore, globalScore, partialReport, reportScope } from "./reportSummaryModel";
import type { Report } from "./types";

/** Sanitize individual values before serialization so escaped newlines cannot defeat redaction. */
function sanitize(value: unknown): unknown {
  if (typeof value === "string") return cleanEvidence(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitize(item)]),
  );
  return value;
}

/** A self-contained server export of the same canonical findings shown in the report. */
export function buildReportAiPrompt(report: Report, lang: Lang, model: ReportModel = buildReportModel(report)): string {
  // A summary is intentionally insufficient for an actionable technical export.
  if (report.access === "summary") return "";
  const copy = (lang === "fr" ? fr : en).report.aiPrompt;
  const coverage = report.scores.coverage;
  const data = {
    domain: report.domain,
    requestedPage: reportScope(report.pageIdentity?.requested ?? report.url) ?? null,
    measuredPage: report.pageIdentity?.destination ? reportScope(report.pageIdentity.destination) ?? null : null,
    generatedAt: report.generatedAt,
    scope: report.scores.scope ?? null,
    partial: partialReport(report),
    antiBotDetected: report.antiBot?.detected ?? false,
    scores: {
      global: globalScore(report) ?? null,
      domains: model.groups.filter(group => group.key !== "unknown").map(group => ({
        domain: group.key, score: domainScore(group.score?.score, group.key, coverage) ?? null,
      })),
    },
    coverage: coverage ? {
      global: coverage.global, domains: coverage.domains,
      unmeasuredChecks: coverage.checks.filter(check => check.state !== "MEASURED"),
    } : null,
    moduleExecution: report.scores.moduleExecution ?? null,
    moduleSuccessPercent: report.scores.completeness ?? null,
    detectedTechnology: {
      cms: report.tech?.cms ?? null,
      frontendFramework: report.tech?.frontendFramework ?? null,
    },
    priorities: model.priorities.map(({ priority, findings, status }, index) => ({
      order: index + 1, title: priority.title, severity: priority.severity,
      impact: priority.impact, effort: priority.effort ?? null,
      findingKeys: findings.map(finding => finding.key), findingLinks: status,
    })),
    findings: model.findings.map(({ key, domain, issue, sources }) => {
      const content = findingContent(issue, lang);
      const guide = findingExplanation(issue, lang);
      return {
        key, domain, severity: issue.severity, confidence: issue.confidence ?? "UNKNOWN", sources,
        title: content.title, observation: content.observation, impact: content.impact,
        recommendation: content.recommendation, steps: guide.steps, verification: content.verification,
        limits: guide.limits, missingInformation: content.missingInformation ?? null,
        original: { title: issue.title, impact: issue.impact, recommendation: issue.recommendation },
        evidence: issue.evidence ?? null, structuredEvidence: issue.structuredEvidence ?? null,
      };
    }),
  };
  return [copy.promptIntro, copy.promptInstructions, copy.promptLimits,
    model.findings.length === 0 ? copy.promptEmpty : "",
    copy.promptData, JSON.stringify(sanitize(data), null, 2), copy.promptEnd,
  ].filter(Boolean).join("\n\n");
}
