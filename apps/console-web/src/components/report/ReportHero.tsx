"use client";

import { buildReportModel, ReportModel } from "./reportModel";
import type { Report } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { decisionCopy } from "./decisionCopy";
import { reportReadingCopy } from "./reportReadingCopy";
import { globalScore, reportScope } from "./reportSummaryModel";
import ReportSummary from "./ReportSummary";
import RelaunchButton from "./RelaunchButton";
import s from "./ReportHero.module.scss";

export default function ReportHero({ report, model = buildReportModel(report), onActions, onMethod }: {
  report: Report; model?: ReportModel; onActions?: () => void; onMethod?: () => void;
}) {
  const { t, lang } = useLang();
  const copy = decisionCopy[lang];
  const reading = reportReadingCopy[lang];
  const score = globalScore(report);
  const coverage = report.scores.coverage;
  const scope = reportScope(report.url);
  const date = new Date(report.generatedAt);
  const domainRating = report.site?.domainRating;
  const hasDomainRating = domainRating != null && Number.isFinite(domainRating.score)
    && domainRating.score >= 0 && domainRating.score <= 100;
  return <section className={s.hero} aria-labelledby="report-domain">
    <div className={s.heroInner}>
      <div className={s.identity}>
        <h1 id="report-domain" className={s.siteName}>{report.domain}</h1>
        <div className={s.meta}>
          <span>{t.report.hero.analyzedAt} {Number.isFinite(date.getTime())
            ? <time dateTime={report.generatedAt}>{date.toLocaleDateString(t.report.hero.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>
            : copy.dateUnknown}</span>
          {report.site?.title && <span>{copy.siteTitle}: {report.site.title}</span>}
          {hasDomainRating && <span className={s.domainRating} title={t.report.hero.domainRatingTooltip}>
            <strong>DR {Math.round(domainRating.score)}/100</strong> · {t.report.hero.domainRatingFetchedAt} {new Date(domainRating.fetchedAt).toLocaleDateString(t.report.hero.locale, { timeZone: "UTC" })} · <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer">Domain Rating by Ahrefs</a>
          </span>}
        </div>
        <p className={s.scope}>{copy.scope}: {scope ?? copy.scopeUnknown}</p>
        <p className={s.privacy}>{copy.privacy}</p>
      </div>
      <div className={s.topRow}>
        <div className={s.decision}>
          <ReportSummary report={report} model={model} />
          <div className={s.links}>
            <a href="?view=actions" onClick={event => { if (onActions) { event.preventDefault(); onActions(); } }}>{copy.actions}</a>
            <a href="#report-method" onClick={event => { if (onMethod) { event.preventDefault(); onMethod(); } }}>{copy.methodLink}</a>
          </div>
        </div>
        <div className={s.scoreBlock}>
          <h2 className={s.scoreTitle}>{reading.score}</h2>
          {score !== undefined ? <p className={s.scoreNumber} aria-label={`Score ${score}/100`}><strong>{score}</strong><span>/100</span></p>
            : <p className={s.notEvaluated}>{copy.notEvaluated}</p>}
          {score !== undefined && <p className={s.scoreState}>{coverage?.provisional ? copy.provisional : copy.measured}</p>}
          <p className={s.coverage}><strong>{reading.coverage}</strong><br />{coverage
            ? `${Math.round(coverage.global.ratio * 100)} % — ${coverage.global.sufficient ? t.report.measurementCoverage.sufficient : copy.insufficient}`
            : copy.coverageUnknown}</p>
          <RelaunchButton url={report.url} />
        </div>
      </div>
      <div className={s.statsRow}>
        {(["critical", "important", "opportunity"] as const).map(key => <div key={key} className={s.stat}>
          <strong className={key === "critical" && model.counts.critical ? s.criticalCount : s.statValue}>{model.counts[key]}</strong>
          <span className={s.statLabel}>{t.report.hero.severity[key]}</span>
        </div>)}
        <div className={s.stat}><strong className={s.statValue}>{model.counts.total}</strong><span className={s.statLabel}>{t.report.hero.issues}</span></div>
      </div>
    </div>
  </section>;
}
