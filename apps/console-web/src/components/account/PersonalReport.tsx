"use client";
import { useEffect, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "./AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import type { Report } from "@/components/report/types";
import Link from "@/components/LocalizedLink";
import s from "./AccountView.module.scss";
import HistoryActions from "./HistoryActions";
import type { HistoryContext } from "./history";
export default function PersonalReport({ runId }: { runId: string }) {
  const [history,setHistory]=useState<{runId:string;context:HistoryContext}|null>(null);
  const [report,setReport]=useState<{runId:string;data:Report}|null>(null),[status,setStatus]=useState(""),[error,setError]=useState(""),[siteId,setSiteId]=useState<string|null>(null);
  const {t}=useLang(),session=useAccountSession();
  const allowed=session.profile?.verified && !session.denied;
  const invalidate=session.invalidate;
  useEffect(()=>{
    let alive=true,terminal=false,inflight=false,retries=0;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const controller=new AbortController();
    queueMicrotask(()=>{if(alive){setReport(null);setSiteId(null);setError("");setStatus("");}});
    if(!allowed) return ()=>{alive=false;};
    const schedule=(delay:number)=>{if(alive&&!terminal&&!document.hidden) timer=setTimeout(poll,delay);};
    async function poll() {
      if(!alive||terminal||inflight||document.hidden) return;
      inflight=true;
      try {
        const run=await accountFetch<{status:string;siteId:string|null;historyContext?:HistoryContext}>("runs/"+runId,"GET",undefined,controller.signal);
        if(!alive) return;
        setHistory(run.historyContext ? {runId,context:run.historyContext} : null);
        setSiteId(run.siteId);setStatus(t.account.statuses[run.status as keyof typeof t.account.statuses]??t.account.working);
        if(run.status==="COMPLETED") {
          const data=await accountFetch<Report>("runs/"+runId+"/report","GET",undefined,controller.signal);
          if(alive) {setReport({runId,data});window.dispatchEvent(new Event("argos-usage-refresh"));}terminal=true;
        } else if(run.status==="FAILED") {terminal=true;window.dispatchEvent(new Event("argos-usage-refresh"));}
        retries=0;schedule(1500);
      } catch(reason) {
        if(!alive) return;
        invalidate(reason);
        const transient=!(reason instanceof AccountClientError) || reason.status===429 || reason.status>=500;
        if(transient && ++retries<=3) schedule(Math.max(reason instanceof AccountClientError ? reason.retryAfter*1000 : 0,1500*2**retries));
        else {terminal=true;setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");}
      } finally {inflight=false;}
    }
    const visibility=()=>{clearTimeout(timer);if(!document.hidden) void poll();};
    document.addEventListener("visibilitychange",visibility);void poll();
    return ()=>{alive=false;controller.abort();clearTimeout(timer);document.removeEventListener("visibilitychange",visibility);};
  },[runId,t,allowed,invalidate]);
  const back=<Link href={allowed && siteId ? "/account/sites/"+siteId : "/account/sites"}>{allowed && siteId ? t.account.sites.back : t.account.sites.title}</Link>;
  if(!session.ready) return <main className={s.page}><p role="status">{t.account.working}</p></main>;
  if(!allowed) return <main className={s.page}><h1>{t.account.openReport}</h1><p role="alert">{session.profile ? t.account.pending : t.account.errors.session_invalid}</p><Link href={"/account/sign-in?returnTo="+encodeURIComponent("/account/runs/"+runId)}>{t.account.signIn}</Link>{back}</main>;
  if(report?.runId===runId) return <><div className={s.personalNav}>{back}</div>{history?.runId===runId && <div className={s.page}><HistoryActions context={history.context} launchBlocked={session.usage?.canLaunch===false}/></div>}<ReportPage embedded params={{report:report.data}} feedbackReference={{runId}}/></>;
  return <><main className={s.page}><h1>{t.account.openReport}</h1><p role={error ? "alert" : "status"}>{error==="resource_unavailable" ? t.account.sites.unavailable : error ? t.account.errors[error as keyof typeof t.account.errors]??t.account.errors.account_unavailable : status||t.account.working}</p>{back}{history?.runId===runId ? <HistoryActions context={history.context} launchBlocked={session.usage?.canLaunch===false}/> : <Link href="/account/sites?analyse=1">{t.account.sites.analyse}</Link>}</main></>;
}
