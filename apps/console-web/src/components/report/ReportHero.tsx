"use client";

import ReportPageScope from "./ReportPageScope";

import { buildReportModel, ReportModel } from "./reportModel";
import type { Report, ReportIntroduction } from "./types";
import ReportIntroductionView from "./ReportIntroductionView";
import { useLang } from "@/lib/i18n/LangContext";
import { decisionCopy } from "./decisionCopy";
import { reportReadingCopy } from "./reportReadingCopy";
import { globalScore, partialReport } from "./reportSummaryModel";
import ReportSummary from "./ReportSummary";
import RelaunchButton from "./RelaunchButton";
import ShareReportButton from "./ShareReportButton";
import s from "./ReportHero.module.scss";
import { scoreLimit, interpretationCopy } from "./reportInterpretation";

export default function ReportHero({ report, model = buildReportModel(report), onActions, onMethod, introduction = report.introduction, onSelectFinding, personal = false }: {
  personal?: boolean; report: Report; model?: ReportModel; onActions?: () => void; onMethod?: () => void; introduction?: ReportIntroduction | null; onSelectFinding?: (key: string) => void;
}) {
  const { t, lang } = useLang();
  const copy = decisionCopy[lang];
  const reading = reportReadingCopy[lang];
  const score = globalScore(report);
  const coverage = report.scores.coverage;
  const date = new Date(report.generatedAt);
  const domainRating = report.site?.domainRating;
  const hasDomainRating = domainRating != null && Number.isFinite(domainRating.score)
    && domainRating.score >= 0 && domainRating.score <= 100;
  return <section className={s.hero} aria-labelledby="report-domain">
    <div className={s.heroInner}>
      <div className={s.identity}>
        <h1 id="report-domain" className={s.siteName}>{report.domain}</h1>
        <details><summary>{interpretationCopy[lang].metadata}</summary><div className={s.meta}>
          <span>{t.report.hero.analyzedAt} {Number.isFinite(date.getTime())
            ? <time dateTime={report.generatedAt}>{date.toLocaleDateString(t.report.hero.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>
            : copy.dateUnknown}</span>
          {report.site?.title && <span>{copy.siteTitle}: {report.site.title}</span>}
          {hasDomainRating && <span className={s.domainRating} title={t.report.hero.domainRatingTooltip}>
            <strong>DR {Math.round(domainRating.score)}/100</strong> · {t.report.hero.domainRatingFetchedAt} {new Date(domainRating.fetchedAt).toLocaleDateString(t.report.hero.locale, { timeZone: "UTC" })} · <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer">Domain Rating by Ahrefs</a>
          </span>}
        </div><p className={s.privacy}>{copy.privacy}</p></details>
        <div className={s.scope}><ReportPageScope report={report} lang={lang} /></div>
      </div>
      {introduction && <ReportIntroductionView note={introduction} model={model} lang={lang} onSelectFinding={onSelectFinding} />}
      <div className={s.topRow}>
        <div className={s.decision}>
          <ReportSummary report={report} model={model} />
          <div className={s.links}>
            <a href="?view=actions" onClick={event => { if (onActions) { event.preventDefault(); onActions(); } }}>{copy.actions}</a>
            <a href="#report-method" onClick={event => { if (onMethod) { event.preventDefault(); onMethod(); } }}>{copy.methodLink}</a>
          </div>
          {!personal && <div className={s.actions}>
            <RelaunchButton url={report.pageIdentity && !report.pageIdentity.redacted ? report.url : ""} />
            <ShareReportButton />
          </div>}
        </div>
        <div className={s.scoreBlock}>
          <h2 className={s.scoreTitle}>{reading.score}</h2>
          {score !== undefined ? <p className={s.scoreNumber} aria-label={`Score ${score}/100`}><strong>{score}</strong><span>/100</span></p>
            : <p className={s.notEvaluated}>{copy.notEvaluated}</p>}
          {score !== undefined && <p className={s.scoreState}>{partialReport(report) ? copy.provisional : copy.measured}</p>}
          <p className={s.coverage}><strong>{reading.coverage}</strong><br />{coverage
            ? `${Math.round(coverage.global.ratio * 100)} % — ${coverage.global.sufficient ? t.report.measurementCoverage.sufficient : copy.insufficient}`
            : copy.coverageUnknown}</p>
          <p className={s.coverage}>{scoreLimit(report, lang)}</p>
        </div>
      </div>
      {model.counts.total > 0 && <p className={s.privacy}>{interpretationCopy[lang].severity}</p>}
      <div className={s.statsRow}>
        {(["critical", "important", "opportunity"] as const).map(key => <div key={key} className={s.stat}>
          <strong className={key === "critical" && model.counts.critical ? s.criticalCount : s.statValue}>{model.counts[key]}</strong>
          <span className={s.statLabel}>{t.report.hero.severity[key]}</span>
        </div>)}
        <div className={s.stat}><strong className={s.statValue}>{model.counts.total}</strong><span className={s.statLabel}>{model.counts.total === 1 ? t.report.hero.issuesOne : t.report.hero.issues}</span></div>
      </div>
    </div>
  </section>;
}
