"use client";

import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { CATALOGUE_VERSION } from "./findingCatalogue";
import { decisionCopy } from "./decisionCopy";
import { reportReadingCopy } from "./reportReadingCopy";
import { reportScope } from "./reportSummaryModel";
import type { ReportModel } from "./reportModel";
import type { Report } from "./types";
import s from "./ReportMethod.module.scss";

export default function ReportMethod({ report, model, open, onToggle }: {
  report: Report; model: ReportModel; open: boolean; onToggle: (open: boolean) => void;
}) {
  const { t, lang } = useLang();
  const copy = decisionCopy[lang];
  const reading = reportReadingCopy[lang];
  const coverage = report.scores.coverage;
  const evidence = report.accessibilityEvidence;
  const sources = [...new Set([
    ...(coverage?.checks.map(check => check.module) ?? []),
    ...(report.scores.calculation?.checks?.map(check => check.module) ?? []),
    ...model.findings.flatMap(finding => [...finding.sources, finding.issue.structuredEvidence?.source]),
    ...(evidence ? ["Lighthouse"] : []),
  ].filter((source): source is string => !!source))];
  const unmeasured = [...new Set((coverage?.checks ?? []).filter(check =>
    check.state === "UNAVAILABLE" || check.state === "BLOCKED_BY_ANTIBOT").map(check => check.module))];
  const versions = [
    report.scores.calculation && `${copy.scoring}: ${report.scores.calculation.scoringVersion}`,
    coverage && `${copy.coverageVersion}: ${coverage.version}`,
    `${copy.editorial}: ${CATALOGUE_VERSION}`,
    evidence?.sourceVersion && `Lighthouse: ${evidence.sourceVersion}`,
    evidence?.version && `${copy.evidence}: ${evidence.version}`,
    evidence?.mappingVersion && `${copy.mapping}: ${evidence.mappingVersion}`,
    report.accessibilityCompliance?.accessibilityComplianceVersion && `${copy.compliance}: ${report.accessibilityCompliance.accessibilityComplianceVersion}`,
    ...[...new Set((report.summary.priorities ?? []).map(priority => priority.rankingVersion).filter(Boolean))].map(version => `${copy.ranking}: ${version}`),
    report.scores.calculation?.scoringFingerprint && `${copy.fingerprint}: ${report.scores.calculation.scoringFingerprint}`,
    report.tech?.nextJs?.version?.exact && `Next.js: ${report.tech.nextJs.version.exact}`,
  ].filter(Boolean);
  return <details id="report-method" open={open} className={s.method} onToggle={event => onToggle(event.currentTarget.open)}>
    <summary id="report-method-toggle">{copy.method}</summary>
    <div className={s.body}>
      <h2>{copy.method}</h2>
      <dl className={s.facts}>
        <div><dt>{copy.scope}</dt><dd>{reportScope(report.url) ?? copy.scopeUnknown}</dd></div>
        <div><dt>{t.report.hero.analyzedAt}</dt><dd>{Number.isFinite(new Date(report.generatedAt).getTime()) ? <time dateTime={report.generatedAt}>{new Date(report.generatedAt).toLocaleString(t.report.hero.locale, { timeZone: "UTC", timeZoneName: "short" })}</time> : copy.dateUnknown}</dd></div>
        <div><dt>{reading.coverage}</dt><dd>{coverage ? `${Math.round(coverage.global.ratio * 100)} %` : copy.coverageUnknown}</dd></div>
        {typeof report.scores.completeness === "number" && <div><dt>{reading.moduleCompleteness}</dt><dd>{report.scores.completeness} %</dd></div>}
      </dl>
      <p>{copy.coverageExplain}</p><p>{copy.completenessExplain}</p><p>{copy.confidenceExplain}</p>
      {coverage && <><h3>{copy.checks}</h3><ul>{(["MEASURED", "UNAVAILABLE", "BLOCKED_BY_ANTIBOT", "NOT_APPLICABLE"] as const).map(state =>
        <li key={state}>{t.report.measurementCoverage.states[state]}: {coverage.checks.filter(check => check.state === state).length}</li>)}</ul></>}
      {!!unmeasured.length && <p><strong>{copy.missingModules}:</strong> {unmeasured.join(", ")}</p>}
      {report.antiBot?.detected && <p>{copy.antiBot}</p>}
      <h3>{copy.source}</h3><p>{sources.join(", ") || copy.sourcesUnknown}</p>
      <h3>{copy.versions}</h3><ul>{versions.map((version, index) => <li key={index}>{version}</li>)}</ul>
      {!report.scores.calculation && <p>{copy.versionsUnknown}</p>}
      <p>{copy.lighthouse}</p><p>{copy.automaticLimit}</p><p>{reading.limits}</p><p>{reading.next}</p>
      <Link href="/methodologie-score">{copy.generalMethod}</Link>
    </div>
  </details>;
}
