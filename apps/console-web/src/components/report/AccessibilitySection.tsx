"use client";

import { useLang } from "@/lib/i18n/LangContext";
import type { Report } from "./types";
import s from "./AccessibilitySection.module.scss";

/** Sources are references supplied by the persisted backend, never inferred in the browser. */
export function safeAccessibilitySource(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!["www.w3.org", "eur-lex.europa.eu", "www.legifrance.gouv.fr"].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

function translated(dict: Record<string, string>, key: string, fallback: string): string {
  return Object.hasOwn(dict, key) ? dict[key] : fallback;
}

export default function AccessibilitySection({ report }: { report: Report }) {
  const { t } = useLang();
  const copy = t.report.accessibility;
  const evidence = report.accessibilityEvidence;
  const qualification = report.accessibilityCompliance;
  if (!evidence && !qualification) return null;
  const score = report.scores.byCategory.find(c => c.key === "a11y")?.score;
  const coverage = evidence?.coverage ?? "UNAVAILABLE";
  const lighthouseScore = coverage !== "UNAVAILABLE" && typeof evidence?.lighthouseScore === "number"
    && Number.isFinite(evidence.lighthouseScore) && evidence.lighthouseScore >= 0 && evidence.lighthouseScore <= 100
    ? evidence.lighthouseScore : null;
  const unknown = copy.unknown;
  const rulesReview = qualification?.rulesValidated === true ? "VALIDATED"
    : qualification?.rulesValidated === false ? "PENDING" : "UNKNOWN";
  const findings = evidence?.findings ?? [];
  const references = (qualification?.references ?? []).flatMap(ref => {
    const href = safeAccessibilitySource(ref.url);
    return href ? [{ ...ref, href }] : [];
  });

  return (
    <section className={s.section} aria-labelledby="accessibility-title">
      <h2 id="accessibility-title" className={s.title}>{copy.title}</h2>
      <p className={s.note}>{copy.limit}</p>
      <dl className={s.facts}>
        <div><dt>{copy.technicalScore}</dt><dd>{score == null ? unknown : `${score}/100`}</dd></div>
        <div><dt>{copy.lighthouseScore}</dt><dd>{lighthouseScore == null ? unknown : `${lighthouseScore}/100`}</dd></div>
        <div><dt>{copy.coverageTitle}</dt><dd>{translated(copy.coverage, coverage, unknown)}</dd></div>
        <div><dt>{copy.scopeTitle}</dt><dd>{(qualification?.scopes ?? ["UNKNOWN"]).map(scope =>
          translated(copy.scopes, scope, unknown)).join(" · ")}</dd></div>
        <div><dt>{copy.confidenceTitle}</dt><dd>{translated(copy.confidence, qualification?.confidence ?? "UNKNOWN", unknown)}</dd></div>
        <div><dt>{copy.riskTitle}</dt><dd>{translated(copy.risk, qualification?.risk ?? "UNKNOWN", unknown)}</dd></div>
        {qualification && <div><dt>{copy.rulesReviewTitle}</dt><dd>{copy.rulesReview[rulesReview]}</dd></div>}
      </dl>
      {qualification && <p className={s.note}>{translated(copy.riskReasons, qualification.riskReason, unknown)}</p>}
      {qualification && <p className={s.note}>{copy.rulesSnapshot}</p>}
      {evidence && coverage !== "UNAVAILABLE" && (
        <>
          <p>{copy.counts.replace("{audits}", String(evidence.referencedAudits))
            .replace("{failed}", String(evidence.failedAudits))
            .replace("{shown}", String(evidence.surfacedFindings))}</p>
          <p className={s.note}>{copy.elements.replace("{count}", String(evidence.reportedElements))}
            {!evidence.elementCountComplete && ` — ${copy.elementsIncomplete}`}</p>
          <ul className={s.statuses}>
            {(["PASS", "FAIL", "MANUAL", "NOT_APPLICABLE", "NOT_TESTED", "ERROR"] as const).map(status =>
              <li key={status}>{copy.statuses[status]} : {evidence.statusCounts[status] ?? 0}</li>)}
          </ul>
          {evidence.truncated && <p className={s.note}>{copy.truncated}</p>}
          {!evidence.failedAudits && <p>{copy.noFailure}</p>}
        </>
      )}
      {findings.length > 0 && (
        <details className={s.details}>
          <summary tabIndex={0}>{copy.findingsTitle}</summary>
          <ul className={s.findings}>
            {findings.map(finding => {
              const description = Object.hasOwn(copy.kinds, finding.kind) ? copy.kinds[finding.kind] : copy.kinds.OTHER;
              return <li key={finding.id}>
                <h3>{description.title}</h3>
                <p>{copy.severityTitle} : {translated(copy.severity, finding.severity, unknown)}</p>
                <p>{description.impact}</p>
                <p>{description.recommendation}</p>
                <p className={s.note}>{copy.evidenceTitle} : {finding.id}
                  {finding.reportedElements != null && ` · ${copy.elementCount.replace("{count}", String(finding.reportedElements))}`}
                </p>
                <p className={s.note}>{finding.wcagCriteria.length
                  ? `${copy.mapping} ${finding.wcagCriteria.join(", ")}` : copy.unmapped}</p>
              </li>;
            })}
          </ul>
        </details>
      )}
      {qualification && (
        <details className={s.details}>
          <summary tabIndex={0}>{copy.qualificationTitle}</summary>
          <h3>{copy.signalsTitle}</h3>
          {qualification.signals.length ? <ul>{qualification.signals.map((signal, index) =>
            <li key={`${signal.code}-${index}`}>
              {translated(copy.information, signal.code, unknown)} : {signal.value ? copy.yes : copy.no}
              {" · "}{translated(copy.provenance, signal.provenance, unknown)}
            </li>)}</ul> : <p>{copy.noSignal}</p>}
          <h3>{copy.missingTitle}</h3>
          {qualification.missingInformation.length ? <ul>{qualification.missingInformation.map((info, index) =>
            <li key={`${info}-${index}`}>{translated(copy.information, info, unknown)}</li>)}</ul> : <p>{copy.noMissing}</p>}
          {references.length > 0 && <><h3>{copy.sourcesTitle}</h3><ul>{references.map(ref =>
            <li key={ref.href}><a href={ref.href} target="_blank" rel="noopener noreferrer">{ref.title}</a></li>)}</ul></>}
        </details>
      )}
      <p className={s.note}>{copy.manual}</p>
      <p className={s.note}>{copy.versions} : {evidence?.version ?? unknown}
        {evidence?.sourceVersion && ` · Lighthouse ${evidence.sourceVersion}`}
        {evidence?.mappingVersion && ` · ${evidence.mappingVersion}`}
        {qualification && ` · ${qualification.accessibilityComplianceVersion}`}</p>
    </section>
  );
}
