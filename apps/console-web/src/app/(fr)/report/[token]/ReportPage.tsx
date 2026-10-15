"use client";
import {useEffect,useMemo,useState} from "react";
import {usePathname} from "next/navigation";
import ReportFeedback,{FeedbackReportContext} from "@/components/feedback/ReportFeedback";
import type {FeedbackReference} from "@/lib/feedback-request";
import {accountFetch} from "@/lib/account-client";
import {buildReportModel, type FindingSelection} from "@/components/report/reportModel";
import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import ReportNavigation from "@/components/report/ReportNavigation";
import {useReportReading} from "@/components/report/reportReading";
import {reportReadingCopy} from "@/components/report/reportReadingCopy";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import AccessibilitySection from "@/components/report/AccessibilitySection";
import ObservedMeasurements from "@/components/report/ObservedMeasurements";
import ReportExport from "@/components/report/ReportExport";
import OwnerReportShare from "@/components/report/OwnerReportShare";
import ReportAccountPrompt from "@/components/report/ReportAccountPrompt";
import RunClaim from "@/components/account/RunClaim";
import PublicReportHistory from "@/components/account/PublicReportHistory";
import ReportIntroductionEditor from "@/components/report/ReportIntroductionEditor";
import type {Report} from "@/components/report/types";
import {useLang} from "@/lib/i18n/LangContext";
import s from "./report.module.scss";
import actions from "@/components/report/ReportActions.module.scss";

type Params={params:{report:Report};feedbackReference?:FeedbackReference;embedded?:boolean;shared?:boolean;runId?:string;demo?:boolean};
export default function ReportPage({params,feedbackReference,embedded=false,shared=false,runId,demo=false}:Readonly<Params>){
  const pathname=usePathname(),{lang}=useLang(),fr=lang==="fr";
  const token=/^\/(?:en\/)?(?:report|share)\/([A-Za-z0-9_-]{20,512})$/.exec(pathname??"")?.[1];
  const [loaded,setLoaded]=useState<{initial:Report;value:Report}|null>(null);
  const report=loaded?.initial===params.report?loaded.value:params.report;
  const locked=report.access==="summary"&&!demo;
  const model=useMemo(()=>buildReportModel(report),[report]),reading=useReportReading(model),copy=reportReadingCopy[lang];
  const [noteState,setNoteState]=useState({report,note:report.introduction});
  const note=noteState.report===report?noteState.note:report.introduction;
  useEffect(()=>{if(!demo)window.dispatchEvent(new Event("argos-report-displayed"));},[demo]);
  useEffect(()=>{const reset=()=>setLoaded(null);window.addEventListener("argos-account-invalid",reset);return()=>window.removeEventListener("argos-account-invalid",reset);},[]);
  useEffect(()=>{
    if(!token||params.report.access!=="summary"||demo)return;
    let alive=true;const controller=new AbortController();
    async function load(){try{const response=await fetch("/api/account/session",{cache:"no-store",signal:controller.signal});
      if(!response.ok||!(await response.json()).signedIn)return;
      const value=await accountFetch<Report>((shared?"shared-reports/":"reports/")+token,"GET",undefined,controller.signal);
      if(alive)setLoaded({initial:params.report,value});
    }catch{/* Summary remains available for anonymous, unverified or expired sessions. */}}
    void load();return()=>{alive=false;controller.abort();};
  },[params.report,token,shared,demo]);
  const selectFinding=(key:string)=>{const finding=model.findings.find(item=>item.key===key);if(finding)reading.navigate({view:"technical",domain:"all",severity:"all",anchor:finding.anchor});};
  const selection:FindingSelection|undefined=reading.finding?{key:reading.finding.key,request:0}:undefined;
  const reference=feedbackReference??(!shared&&token?{reportToken:token}:undefined);
  const Content=demo?"div":"main";
  return <FeedbackReportContext.Provider value={reference}><div className={s.page+" "+(embedded?s.embedded:"")} id={demo?undefined:"top"}>
    {!embedded&&!demo&&<ReportHeader/>}
    <ReportHero demo={demo} personal={embedded||shared||demo} report={report} model={model} introduction={locked?null:note} onSelectFinding={selectFinding} onActions={()=>reading.navigate({view:"actions",anchor:""})}/>
    <Content className={s.main}>
      {shared&&<p>{fr?"Rapport partagé · Lecture seule · Historique du propriétaire non partagé":"Shared report · Read only · Owner history not shared"}</p>}
      {!demo&&<div className={actions.toolbar}>{runId&&<OwnerReportShare runId={runId}/>}<ReportExport report={report} runId={runId} shared={shared}/></div>}
      {locked&&reading.view==="overview"&&<ReportAccountPrompt shared={shared}/>}
      {!embedded&&!shared&&!demo&&!locked&&<><RunClaim/><PublicReportHistory/></>}
      <ReportNavigation view={reading.view} onChange={view=>reading.navigate({view,anchor:""})} locked={locked}/>
      {reading.missing&&<p role="status">{copy.missing}</p>}
      {reading.view==="overview"?<section className={s.view} id="report-overview" aria-label={copy.overview}>
        <ScoreGrid categories={report.scores.byCategory} model={model} coverage={report.scores.coverage} onSelectDomain={domain=>reading.navigate({view:"technical",domain,severity:"all",anchor:""})}/>
        <ObservedMeasurements report={report} lang={lang}/>
        {locked?<section className={s.summaryPriorities}><h2>{fr?"Par où commencer":"Where to start"}</h2>{report.summary.priorities.slice(0,3).map((p,i)=><article key={i}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{p.title}</h3><p>{p.impact}</p></div><button onClick={()=>reading.navigate({view:"technical",anchor:""})}>{fr?"Voir les détails →":"View details →"}</button></article>)}</section>:<PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding} limit={3}/>}
      </section>:locked?<ReportAccountPrompt shared={shared}/>:reading.view==="actions"?<section className={s.view} id="report-actions" aria-label={copy.actions}><PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding}/></section>:<section className={s.view} id="report-technical" aria-label={copy.technical}><IssuesByCategory report={report} model={model} selection={selection} domain={reading.domain} severity={reading.severity} onFilterChange={(domain,severity)=>reading.navigate({domain,severity,anchor:""})}/><AccessibilitySection report={report}/></section>}
      {!locked&&!shared&&!demo&&<ReportIntroductionEditor key={token} token={token} model={model} onPublished={note=>setNoteState({report,note})}/>}
      {!demo&&!shared&&<ReportFeedback/>}
    </Content>
  </div></FeedbackReportContext.Provider>;
}
