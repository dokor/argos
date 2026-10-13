"use client";
import { useEffect, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "./AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import type { Report } from "@/components/report/types";
import Link from "@/components/LocalizedLink";
import { PageHeading, EmptyState } from "@/components/connected/Primitives";
import RunContext, { type PersonalRun } from "@/components/connected/RunContext";
import { analysisCopy } from "@/components/connected/analysisCopy";
import s from "@/components/connected/Analysis.module.scss";
import ui from "@/components/connected/Connected.module.scss";
export default function PersonalReport({ runId }: { runId: string }) {
  const [result,setResult]=useState<{id:string;run:PersonalRun;report?:Report}|null>(null),[failure,setFailure]=useState<{id:string;code:string}|null>(null),[revision,setRevision]=useState(0);
  const {t,lang}=useLang(),c=analysisCopy[lang],session=useAccountSession();
  const allowed=session.profile?.verified && !session.denied,invalidate=session.invalidate;
  useEffect(()=>{
    let alive=true,terminal=false,inflight=false,retries=0;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const controller=new AbortController();
    queueMicrotask(()=>{if(alive){setResult(null);setFailure(null);}});
    if(!allowed) return ()=>{alive=false;};
    const schedule=(delay:number)=>{if(alive&&!terminal&&!document.hidden) timer=setTimeout(poll,delay);};
    async function poll() {
      if(!alive||terminal||inflight||document.hidden) return;
      inflight=true;
      try {
        const run=await accountFetch<PersonalRun>("runs/"+runId,"GET",undefined,controller.signal);
        if(!alive) return;
        setResult({id:runId,run});
        if(run.reportAvailability==="AVAILABLE" || run.status==="COMPLETED" && !["EXPIRED","UNAVAILABLE"].includes(run.reportAvailability??"")) {
          const report=await accountFetch<Report>("runs/"+runId+"/report","GET",undefined,controller.signal);
          if(alive) {setResult({id:runId,run,report});window.dispatchEvent(new Event("argos-usage-refresh"));}terminal=true;
        } else if(["COMPLETED","FAILED"].includes(run.status)) {terminal=true;window.dispatchEvent(new Event("argos-usage-refresh"));}
        retries=0;schedule(1500);
      } catch(reason) {
        if(!alive) return;
        invalidate(reason);
        const transient=!(reason instanceof AccountClientError) || reason.status===429 || reason.status>=500;
        if(transient && ++retries<=3) schedule(Math.max(reason instanceof AccountClientError ? reason.retryAfter*1000 : 0,1500*2**retries));
        else {terminal=true;setFailure({id:runId,code:reason instanceof AccountClientError ? reason.code : "account_unavailable"});}
      } finally {inflight=false;}
    }
    const visibility=()=>{clearTimeout(timer);if(!document.hidden) void poll();};
    document.addEventListener("visibilitychange",visibility);void poll();
    return ()=>{alive=false;controller.abort();clearTimeout(timer);document.removeEventListener("visibilitychange",visibility);};
  },[runId,allowed,invalidate,revision]);
  const current=result?.id===runId ? result : null,run=current?.run,report=current?.report,error=failure?.id===runId ? failure.code : "";
  const back=<Link href={allowed && run?.siteId ? "/account/sites/"+run.siteId : "/account/sites"}>{allowed && run?.siteId ? t.account.sites.back : t.account.sites.title}</Link>;
  if(!session.ready) return <main className={ui.page}><p role="status">{t.account.working}</p></main>;
  if(!allowed) return <main className={ui.page}><h1>{c.progress}</h1><p role="alert">{session.profile ? t.account.pending : t.account.errors.session_invalid}</p><Link href={"/account/sign-in?returnTo="+encodeURIComponent("/account/runs/"+runId)}>{t.account.signIn}</Link>{back}</main>;
  const terminal=run && ["COMPLETED","FAILED"].includes(run.status);
  const expired=run?.reportAvailability==="EXPIRED";
  const unavailable=expired || run?.reportAvailability==="UNAVAILABLE" || error==="resource_unavailable";
  const actions=<nav className={s.navigation} aria-label={c.progress}>{back}{run?.historyContext && <Link href={"/account/urls/"+run.historyContext.siteUrlId+"/history"}>{c.compare}</Link>}<Link href={"/account/analyses/new"+(run?.historyContext ? "?url="+encodeURIComponent(run.historyContext.normalizedUrl) : "")}>{c.fresh}</Link></nav>;
  if(report && run) return <>{actions}{run.status==="FAILED" && <p className={s.context} role="status">{c.failedReport}</p>}<ReportPage embedded params={{report}} feedbackReference={{runId}}/><RunContext runId={runId} run={run} complete/><section className={s.context}><h2>{c.compare}</h2><p>{c.compareHint}</p>{run.historyContext && <Link href={"/account/urls/"+run.historyContext.siteUrlId+"/history"}>{c.compare}</Link>}</section></>;
  return <>{actions}<main className={ui.page}><PageHeading title={c.progress} description={terminal ? undefined : c.durable}/>
    {run && <p role="status">{t.account.statuses[run.status as keyof typeof t.account.statuses]??c.unknown}</p>}
    {unavailable ? <EmptyState title={expired ? c.expired : c.unavailable} description={c.unavailableHint}/> : error ? <EmptyState kind="error" title={c.unavailable} description={t.account.errors[error as keyof typeof t.account.errors]??t.account.errors.account_unavailable}><button className={ui.secondary} onClick={()=>setRevision(v=>v+1)}>{c.refresh}</button></EmptyState> : run?.status==="FAILED" ? <p>{c.failureHint}</p> : !run ? <p role="status">{t.account.working}</p> : null}
  </main>{run && <RunContext run={run} runId={runId}/>}</>;
}
