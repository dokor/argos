"use client";
import type {ReactNode} from "react";
import {buildReportModel, type ReportModel} from "./reportModel";
import type {Report, ReportIntroduction} from "./types";
import {useLang} from "@/lib/i18n/LangContext";
import {decisionCopy} from "./decisionCopy";
import {reportReadingCopy} from "./reportReadingCopy";
import {globalScore, partialReport, reportScope} from "./reportSummaryModel";
import {scoreLimit, interpretationCopy} from "./reportInterpretation";
import ReportIntroductionView from "./ReportIntroductionView";
import ReportPageScope from "./ReportPageScope";
import s from "./ReportHero.module.scss";

export default function ReportHero({report,model=buildReportModel(report),onActions,onMethod,introduction=report.introduction,onSelectFinding,demo=false,actions,context,tip}: {
 report:Report;model?:ReportModel;onActions?:()=>void;onMethod?:()=>void;introduction?:ReportIntroduction|null;onSelectFinding?:(key:string)=>void;personal?:boolean;demo?:boolean;actions?:ReactNode;context?:ReactNode;tip?:ReactNode;
}) {
 const {t,lang}=useLang(),fr=lang==="fr",copy=decisionCopy[lang],reading=reportReadingCopy[lang];
 const score=globalScore(report),coverage=report.scores.coverage,counts=model.counts,date=new Date(report.generatedAt),Title=demo?"h2":"h1";
 const verdict=counts.critical?"critical":score===undefined?"unavailable":counts.important?"important":counts.opportunity?"opportunity":"empty";
 const url=reportScope(report.pageIdentity?.requested??report.url);
 const facts=Object.entries(counts).reduce((text,[key,value])=>text.replace(`{${key}}`,String(value)),reading.summaryFacts as string);
 return <section className={s.hero} aria-labelledby="report-domain">
  {context&&<div className={s.context}>{context}</div>}
  <div className={s.identityRow}><div className={s.identity}>
   <p className={s.eyebrow}>{fr?"Rapport d’audit":"Audit report"}</p>
   <Title id="report-domain" className={s.siteName}>{report.domain}</Title>
   <p className={s.url}>{url??(fr?"Adresse indisponible":"Address unavailable")}</p>
   <p className={s.date}>{Number.isFinite(date.getTime())?<time dateTime={report.generatedAt}>{date.toLocaleString(t.report.hero.locale,{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"UTC"})} UTC</time>:copy.dateUnknown} · {fr?"Analyse ponctuelle":"Point-in-time analysis"}</p>
  </div>{actions&&<div className={s.actions}>{actions}</div>}</div>
  {tip&&<div className={s.tip}>{tip}</div>}
  {report.scores.scope && report.scores.scope.kind!=="full" && <p className={s.provisional} role="status">{fr?"Analyse ciblée · Score partiel":"Targeted analysis · Partial score"} — {report.scores.scope.kind==="category" ? (t.report.priorityCards.domains as Record<string,string>)[report.scores.scope.target??""] : report.scores.scope.target}. {fr?"Aucune mesure précédente réutilisée.":"No previous measurements reused."}</p>}
  <div className={s.result}>
   <div className={s.scoreBlock}><h2 className={s.scoreTitle}>{reading.score}</h2>
    {score!==undefined?<p className={s.scoreNumber} aria-label={`Score ${score}/100`}><strong>{score}</strong><span>/100</span></p>:<p>{copy.notEvaluated}</p>}
    {score!==undefined&&partialReport(report)&&<p className={s.provisional}>{copy.provisional}</p>}
    {score===42&&<p className={s.easterEgg}>{t.easterEggs.fortyTwo}</p>}
    <p className={s.coverage}>{coverage?`${fr?"Couverture":"Coverage"} ${Math.round(coverage.global.ratio*100)} %`:copy.coverageUnknown}</p>
    {onMethod&&<a href="#report-method" className={s.actionLink} onClick={onMethod}>{fr?"Comprendre la couverture":"Understand coverage"}</a>}
   </div>
   <div className={s.decision}><h2>{copy.verdict[verdict]}</h2>
    {score!==undefined&&score>=70&&counts.critical>0&&<p>{copy.favourable}</p>}
    {!counts.total&&<p>{copy.empty}</p>}
    {report.antiBot?.detected?<p>{copy.antiBot}</p>:partialReport(report)&&<p>{reading.partial}</p>}
    <p>{scoreLimit(report,lang)}</p>
    {counts.total>0&&<p>{interpretationCopy[lang].severity}</p>}
    <div className={s.stats}>{(["critical","important","opportunity"] as const).map(key=><span key={key} className={counts[key]?s[key]:undefined}><b>{counts[key]}</b> {t.report.hero.severity[key]}</span>)}</div>
    <a className={s.actionLink} aria-label={copy.actions} href="?view=actions" onClick={event=>{if(onActions){event.preventDefault();onActions();}}}>{copy.actions} <span aria-hidden="true">→</span></a>
   </div>
  </div>
  <details className={s.metadata}><summary>{interpretationCopy[lang].metadata}</summary>
   <p>{facts}</p>
   {coverage&&<p><span>{reading.coverage}</span><br/><span>{`${Math.round(coverage.global.ratio*100)} % — ${coverage.global.sufficient?t.report.measurementCoverage.sufficient:copy.insufficient}`}</span></p>}
   {report.site?.title&&<p>{copy.siteTitle}: {report.site.title}</p>}
   {report.site?.domainRating&&Number.isFinite(report.site.domainRating.score)&&report.site.domainRating.score>=0&&report.site.domainRating.score<=100&&<p><strong>DR {Math.round(report.site.domainRating.score)}/100</strong> · {t.report.hero.domainRatingFetchedAt} {new Date(report.site.domainRating.fetchedAt).toLocaleDateString(t.report.hero.locale,{timeZone:"UTC"})} · <a href="https://ahrefs.com/" target="_blank" rel="noopener noreferrer">Domain Rating by Ahrefs</a></p>}
   <ReportPageScope report={report} lang={lang}/><p>{copy.privacy}</p>
  </details>
  {introduction&&<ReportIntroductionView note={introduction} model={model} lang={lang} onSelectFinding={onSelectFinding}/>}
 </section>;
}
