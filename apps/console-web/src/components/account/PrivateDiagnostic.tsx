"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { Report } from "@/components/report/types";
import { buildReportModel } from "@/components/report/reportModel";
import { globalScore, partialReport, reportScope } from "@/components/report/reportSummaryModel";
import { cleanEvidence, findingContent } from "@/components/report/findingCatalogue";
import { useReportReading } from "@/components/report/reportReading";
import { reportReadingCopy } from "@/components/report/reportReadingCopy";
import ObservedEvidence from "@/components/report/ObservedEvidence";
import ReportNavigation from "@/components/report/ReportNavigation";
import PriorityCards from "@/components/report/PriorityCards";
import ReportMethod from "@/components/report/ReportMethod";
import AccessibilitySection from "@/components/report/AccessibilitySection";
import ReportFeedback, { FeedbackReportContext } from "@/components/feedback/ReportFeedback";
import RunContext, { type PersonalRun } from "@/components/connected/RunContext";
import { PageHeading, StatusBadge } from "@/components/connected/Primitives";
import { diagnosticMeasurements } from "./diagnosticMeasurements";
import ui from "@/components/connected/Connected.module.scss";
import s from "./PrivateDiagnostic.module.scss";

const copy = {
  fr: { title: "Diagnostic de la page", score: "Score de cette page", partial: "Partiel · score provisoire", complete: "Mesure complète", unknown: "Indisponible", requested: "URL demandée", final: "URL finale et statut HTTP", uncollected: "Non conservés dans ce rapport", profile: "Profil demandé", metrics: "Mesures observées", metricHint: "Mesures de laboratoire conservées dans ce rapport. Une valeur absente ne signifie ni zéro ni réussite ; les rapports historiques peuvent omettre les mesures réussies.", bytes: "Transfert estimé", requests: "Requêtes", findings: "Constats et preuves", count: "constats uniques", empty: "Aucun constat conservé. Consulter la couverture avant de conclure.", metadata: "Provenance et détails techniques", context: "Contexte de la mesure", all: "Tous", noResults: "Aucun constat pour ces filtres.", coverage: "Couverture pondérée", unknownCoverage: "Couverture non disponible", limited: "Couverture limitée", antiBot: "Une protection anti-bot limite la page observée." },
  en: { title: "Page diagnosis", score: "Page score", partial: "Partial · provisional score", complete: "Complete measurement", unknown: "Unavailable", requested: "Requested URL", final: "Final URL and HTTP status", uncollected: "Not retained in this report", profile: "Requested profile", metrics: "Observed measurements", metricHint: "Lab measurements retained in this report. Missing does not mean zero or success; historical reports may omit passing measurements.", bytes: "Estimated transfer", requests: "Requests", findings: "Findings and evidence", count: "unique findings", empty: "No retained findings. Check coverage before drawing conclusions.", metadata: "Provenance and technical details", context: "Measurement context", all: "All", noResults: "No findings match these filters.", coverage: "Weighted coverage", unknownCoverage: "Coverage unavailable", limited: "Limited coverage", antiBot: "An anti-bot protection limits the observed page." },
};
function profileId(raw?: string | null) {
  try { const value = JSON.parse(raw ?? "{}"); return typeof value?.profileId === "string" ? value.profileId : undefined; } catch { return undefined; }
}

export default function PrivateDiagnostic({ report, run, runId, actions }: { report: Report; run: PersonalRun; runId: string; actions: ReactNode }) {
  const { t, lang } = useLang(), c = copy[lang], detail = reportReadingCopy[lang];
  const model = useMemo(() => buildReportModel(report), [report]), reading = useReportReading(model);
  const [methodOpen, setMethodOpen] = useState(false);
  const score = globalScore(report), partial = partialReport(report), coverage = report.scores.coverage;
  const complete = coverage ? coverage.global.available && !coverage.provisional : report.scores.completeness === 100;
  const url = reportScope(run.historyContext?.normalizedUrl ?? report.url) ?? c.unknown;
  const domains = t.report.priorityCards.domains as Record<string, string>;
  const findings = model.findings.filter(f => (reading.domain === "all" || f.domain === reading.domain) && (reading.severity === "all" || f.issue.severity === reading.severity));
  useEffect(() => { window.dispatchEvent(new Event("argos-report-displayed")); }, []);
  useEffect(() => {
    if (!reading.finding) return;
    const element = document.getElementById(reading.finding.anchor) as HTMLDetailsElement | null;
    if (element) { element.open = true; element.querySelector("summary")?.focus({ preventScroll: true }); element.scrollIntoView?.({ block: "center" }); }
  }, [reading.finding]);
  return <FeedbackReportContext.Provider value={{ runId }}><main className={`${ui.page} ${s.page}`} id="top">
    {actions}<PageHeading title={c.title} description={url}/>
    <section className={s.hero} aria-label={c.score}>
      <div className={s.heroTop}><div><p className={s.eyebrow}>{c.score}</p><div className={s.score}><strong>{score ?? "—"}</strong>{score !== undefined && <span>/100</span>}<StatusBadge tone={partial || score === undefined || !complete ? "warning" : "success"}>{score === undefined ? c.unknown : partial ? c.partial : complete ? c.complete : c.unknownCoverage}</StatusBadge></div></div>
        <div className={s.identity}><time dateTime={report.generatedAt}>{new Date(report.generatedAt).toLocaleString(lang)}</time><p>{c.profile} : {profileId(run.profileSnapshot) ?? c.unknown}</p></div></div>
      <p>{c.requested} : {url}</p><p className={s.muted}>{c.final} : {c.uncollected}</p>
      <p>{c.coverage} : {coverage?.global.available ? `${Math.round(coverage.global.ratio * 100)} %` : c.unknownCoverage}{coverage?.global.sufficient === false && ` · ${c.limited}`}</p>
      {coverage?.domains.some(d => !d.sufficient) && <p className={s.muted}>{c.limited} : {coverage.domains.filter(d => !d.sufficient).map(d => domains[d.key] ?? d.key).join(", ")}</p>}
      {report.antiBot?.detected && <p>{c.antiBot}</p>}
    </section>
    <section aria-labelledby="diagnostic-measures"><h2 id="diagnostic-measures">{c.metrics}</h2><p className={s.muted}>{c.metricHint}</p><div className={s.metrics}>
      {diagnosticMeasurements(report).map(metric => <div className={s.metric} key={metric.key}><h3>{metric.label === "bytes" ? c.bytes : metric.label === "requests" ? c.requests : metric.label}</h3><strong>{metric.value === undefined ? "—" : new Intl.NumberFormat(lang, { maximumFractionDigits: 3 }).format(metric.unit === "bytes" ? metric.value / 1024 : metric.value)}{metric.value !== undefined && <span> {metric.unit === "bytes" ? "KiB" : metric.unit === "ms" ? "ms" : ""}</span>}</strong><p>{metric.value === undefined ? c.unknown : metric.source || c.unknown}</p></div>)}
    </div></section>
    <ReportNavigation view={reading.view} onChange={view => reading.navigate({ view, domain: "all", severity: "all", anchor: "" })}/>
    {reading.missing && <p role="status">{detail.missing}</p>}
    {reading.view === "actions" ? <PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={key => { const f = model.findings.find(f => f.key === key); if (f) reading.navigate({ view: "technical", domain: "all", severity: "all", anchor: f.anchor }); }}/>
    : <section className={s.findings} aria-labelledby="diagnostic-findings"><h2 id="diagnostic-findings">{c.findings}</h2><p className={s.muted}>{model.counts.total} {c.count} · {model.counts.critical} {t.report.issuesByCategory.severity.critical} · {model.counts.important} {t.report.issuesByCategory.severity.important}</p>
      {reading.view === "technical" && <div className={s.filters}><label>{detail.domain}<select value={reading.domain} onChange={e => reading.navigate({ domain: e.target.value, anchor: "" })}><option value="all">{c.all}</option>{model.groups.map(g => <option key={g.key} value={g.key}>{domains[g.key] ?? t.report.issuesByCategory.unknownDomain}</option>)}</select></label><label>{t.report.issuesByCategory.filterLabel}<select value={reading.severity} onChange={e => reading.navigate({ severity: e.target.value, anchor: "" })}><option value="all">{c.all}</option>{(["critical", "important", "info"] as const).map(key => <option key={key} value={key}>{t.report.issuesByCategory.severity[key]}</option>)}</select></label></div>}
      {!findings.length && <p>{model.counts.total ? c.noResults : c.empty}</p>}
      {findings.map((finding, index) => { const issue = finding.issue, content = findingContent(issue, lang), evidence = issue.structuredEvidence; return <details className={s.finding} key={finding.key} id={finding.anchor} open={index === 0 || reading.finding?.key === finding.key || undefined}>
        <summary><span><strong>{content.title}</strong><small>{domains[finding.domain] ?? t.report.issuesByCategory.unknownDomain} · {t.report.issuesByCategory.severity[issue.severity]}</small></span><span aria-hidden="true" className={s.chevron}>+</span></summary>
        <div className={s.proofGrid}><div><h3>{detail.evidence}</h3><p className={s.muted}>{detail.source} : {evidence?.source || finding.sources.join(", ") || c.unknown}</p>
          <div className={s.proof}>{evidence?.measurement && Number.isFinite(evidence.measurement.value) && Object.hasOwn(detail.units, evidence.measurement.unit) ? <p>{evidence.measurement.value.toLocaleString(lang)} {detail.units[evidence.measurement.unit]}</p> : <p>{detail.missingMeasure}</p>}{issue.evidence && <p>{cleanEvidence(issue.evidence)}</p>}<ObservedEvidence evidence={evidence?.observed} lang={lang}/></div>
          <details className={s.metadata}><summary>{c.metadata}</summary><p>{cleanEvidence(issue.id ?? "")}</p><p>{cleanEvidence(issue.title)}</p><p>{content.qualification}</p><p>{content.observation}</p><p>{t.report.priorityCards.confidenceLabel} : {issue.confidence && issue.confidence !== "UNKNOWN" ? t.report.priorityCards.confidence[issue.confidence] : detail.unknownConfidence}</p>{content.missingInformation && <p>{content.missingInformation}</p>}{evidence?.details?.slice(0,20).map((item,i) => <p key={i}><strong>{cleanEvidence(item.key)}</strong> : {cleanEvidence(item.text)}</p>)}{issue.id && <ReportFeedback findingKey={issue.id}/>}</details>
        </div><div><h3>{detail.recommendation}</h3><p>{content.recommendation}</p><h3>{detail.verification}</h3><p>{content.verification}</p><p className={s.muted}>{content.impact}</p></div></div>
      </details>; })}
    </section>}
    <ReportMethod report={report} model={model} open={methodOpen} onToggle={setMethodOpen}/>
    {(report.accessibilityEvidence || report.accessibilityCompliance) && <details className={s.secondary}><summary>{t.report.accessibility.limit}</summary><AccessibilitySection report={report}/></details>}
    <details className={s.secondary}><summary>{c.context}</summary><RunContext run={run} runId={runId} complete/></details><ReportFeedback/>
  </main></FeedbackReportContext.Provider>;
}
