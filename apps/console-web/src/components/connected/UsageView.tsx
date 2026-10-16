"use client";
import ContextHelp from "@/components/ui/ContextHelp";
import { clarteCopy } from "./clarteCopy";
import { compactUrl } from "./compactCopy";
import { quotaResetDate } from "@/lib/quota-date";
import {useEffect,useState} from "react";
import {useSearchParams,useRouter} from "next/navigation";
import {useAccountSession} from "@/components/account/AccountSession";
import {accountFetch,AccountClientError} from "@/lib/account-client";
import {useLang} from "@/lib/i18n/LangContext";
import {localizedPath} from "@/lib/i18n/routes";
import type {UsageEvents,UsageEvent} from "@/lib/connected/contracts";
import Link from "@/components/LocalizedLink";
import {PageHeading,Surface,StatusBadge,EmptyState,DataTable} from "./Primitives";
import s from "./Usage.module.scss";
import c from "./Connected.module.scss";

export default function UsageView() {
  const {t,lang}=useLang(),copy=t.usagePage,session=useAccountSession(),router=useRouter(),params=useSearchParams();
  const clarity=clarteCopy[lang];
  const month=(value:string)=>new Intl.DateTimeFormat(lang,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(value+"-01T00:00:00Z"));
  const {usage,usageError,refreshUsage,invalidate}=session;
  const allowed=!!session.profile?.verified&&!session.denied;
  const period=params.get("period")??usage?.period,rawOffset=params.get("offset")??"0";
  const offset=Number(rawOffset),invalid=!/^(0|[1-9][0-9]{0,15})$/.test(rawOffset)||!Number.isSafeInteger(offset)||(period!==undefined&&!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period));
  const quotaReady=!!usage||usageError;
  const key=`${period??"current"}:${offset}`,limit=20;
  const [result,setResult]=useState<{key:string;data:UsageEvents}|null>(null),[failure,setFailure]=useState<{key:string;code:string}|null>(null),[revision,setRevision]=useState(0),[loadingKey,setLoadingKey]=useState("");
  useEffect(()=>{window.dispatchEvent(new Event("argos-reading"));},[period,offset]);
  useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener("argos-usage-refresh",refresh);return()=>window.removeEventListener("argos-usage-refresh",refresh);},[]);
  useEffect(()=>{
    if(!allowed||invalid||!quotaReady)return;
    let alive=true;const controller=new AbortController(),query=new URLSearchParams({limit:String(limit),offset:String(offset)});
    if(period)query.set("period",period);
    queueMicrotask(()=>{if(alive){setLoadingKey(key);setFailure(null);}});
    void accountFetch<UsageEvents>("usage/events?"+query,"GET",undefined,controller.signal).then(data=>{
      if(alive){setResult({key,data});setFailure(null);setLoadingKey("");}
    }).catch(reason=>{if(alive){invalidate(reason);setFailure({key,code:reason instanceof AccountClientError ? reason.code:"account_unavailable"});setLoadingKey("");}});
    return()=>{alive=false;controller.abort();};
  },[allowed,invalid,key,offset,period,revision,invalidate,quotaReady]);
  const data=result?.key===key ? result.data:null,error=failure?.key===key ? failure.code:"",loading=loadingKey===key;
  const navigate=(selected?:string,page=0)=>{const query=new URLSearchParams();if(selected)query.set("period",selected);if(page)query.set("offset",String(page));router.push(localizedPath("/account/usage"+(query.size ? "?"+query:""),lang));};
  const refresh=()=>{refreshUsage();setRevision(v=>v+1);};
  const number=(value:number)=>new Intl.NumberFormat(lang).format(value);
  const date=(value:string)=>new Date(value).toLocaleString(lang,{timeZone:usage?.timezone??"UTC",dateStyle:"medium",timeStyle:"short"});
  const stateLabels={COUNTED:copy.counted,RESERVED:copy.reserved,RELEASED:copy.released};
  const eventDate=(entry:UsageEvent)=>entry.countedAt??entry.releasedAt??entry.createdAt;
  const historyPeriod=data?.period??period??"";
  return <main className={c.page}>
    <PageHeading title={t.connected.usage} description={copy.intro} action={allowed&&<button className={c.secondary} onClick={refresh}>{copy.refresh}</button>}/>
<ContextHelp topic="credits"/>
    {!allowed ? <EmptyState title={session.profile ? copy.verification:t.connected.sessionTitle} description={session.profile ? t.account.pending:t.account.errors.session_invalid} kind="error"><Link className={c.secondary} href="/account/settings">{t.connected.account}</Link></EmptyState> : <>
      <div className={s.grid}><Surface title={copy.monthly} action={usage&&<StatusBadge>{usage.offer}</StatusBadge>}>
        {usage ? <>
          <p className={s.period}>{copy.currentPeriod} <strong>{month(usage.period)}</strong> · {usage.timezone}</p>
          <p className={s.capacity}><strong>{usage.available===null ? copy.unlimited:number(usage.available)}</strong><span>{usage.limit===null ? copy.noLimit:"/ "+number(usage.limit)+" "+copy.available}</span></p>
          {usage.limit!==null&&usage.limit>0&&usage.available!==null&&<meter className={s.meter} min={0} max={usage.limit} value={Math.max(0,Math.min(usage.limit,usage.available))} aria-label={copy.available} aria-valuetext={`${number(usage.available)} / ${number(usage.limit)} ${copy.available}`}/>}
          <dl className={s.facts}><div><dt>{copy.used}</dt><dd>{number(usage.used)}</dd></div><div><dt>{copy.reserved}</dt><dd>{number(usage.reserved)}</dd></div><div><dt>{copy.limit}</dt><dd>{usage.limit===null ? copy.unlimited:number(usage.limit)}</dd></div></dl>
          <dl className={s.facts}><div><dt>{clarity.domainLimit}</dt><dd className={s.unavailable}>{clarity.unavailable}</dd></div><div><dt>{clarity.concurrent}</dt><dd className={s.unavailable}>{clarity.unavailable}</dd></div></dl>
          <p className={s.reset}>{copy.reset} <time dateTime={usage.resetsAt}>{quotaResetDate(usage.resetsAt,lang,usage.timezone)}</time></p>
          <p className={s.hint}>{copy.calendar}</p>
          {!usage.canLaunch&&<p className={s.notice} role="status">{usage.limit===0 ? copy.zero:copy.exhausted}</p>}
          <Link className={s.link} href="/feedback">{copy.contact}</Link>
        </> : <EmptyState title={usageError ? copy.quotaError:t.connected.loadingQuota} description={usageError ? copy.quotaErrorHint:undefined} kind={usageError ? "error":"loading"}><button className={c.secondary} onClick={refreshUsage}>{t.connected.retry}</button></EmptyState>}
      </Surface><Surface title={copy.rules}>
        <div className={s.rule}><h3>{copy.pageTitle}</h3><p>{copy.pageRule}</p></div>
        <div className={s.rule}><h3>{copy.failureTitle}</h3><p>{copy.failureRule}</p></div>
        <div className={s.rule}><h3>{copy.retryTitle}</h3><p>{copy.retryRule}</p></div>
        <div className={s.rule}><h3>{copy.cancelTitle}</h3><p>{copy.cancelRule}</p></div>
        <div className={s.rule}><h3>{copy.monthTitle}</h3><p>{copy.monthRule}</p></div>
      </Surface></div>
      <section aria-labelledby="usage-history-title" className={s.history}>
        <div className={s.historyHeading}><div><h2 id="usage-history-title">{copy.history}</h2><p className={s.hint}>{copy.historyHint}</p></div>
          <form className={s.filters} key={historyPeriod} onSubmit={event=>{event.preventDefault();const value=String(new FormData(event.currentTarget).get("period"));if(/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(value))navigate(value);}}>
            <label htmlFor="usage-month">{copy.month}<input id="usage-month" name="period" type="month" required defaultValue={historyPeriod}/></label>
            <button className={c.secondary}>{copy.filter}</button><button className={c.secondary} type="button" onClick={()=>navigate()}>{copy.currentMonth}</button>
          </form>
        </div>
        {invalid ? <EmptyState kind="error" title={copy.filterError}><button className={c.secondary} onClick={()=>navigate()}>{copy.currentMonth}</button></EmptyState> : <>
          {error&&<div className={s.notice}><p role="alert">{copy.historyError}</p><button className={c.secondary} onClick={()=>setRevision(v=>v+1)}>{t.connected.retry}</button></div>}
          {!data&&!error ? <EmptyState kind="loading" title={t.connected.loading}/> : data&&<>
            <p className={s.snapshot}>{copy.month} {month(data.period)} · {copy.updated} <time dateTime={data.snapshotAt}>{date(data.snapshotAt)}</time>{loading&&<span role="status"> · {t.connected.loading}</span>}</p>
            {!data.items.length ? <EmptyState title={data.total ? copy.pageEmpty:copy.empty} description={data.total ? undefined:copy.emptyHint}>{data.total>0&&<button className={c.secondary} onClick={()=>navigate(data.period)}>{copy.first}</button>}</EmptyState> : <DataTable caption={copy.history+" · "+month(data.period)} columns={[copy.date,copy.analysis,copy.state,copy.credits]}>{data.items.map(entry=><tr key={entry.runId}>
              <td><time dateTime={eventDate(entry)}>{date(eventDate(entry))}</time>{entry.state==="RELEASED"&&!entry.releasedAt&&<p className={s.hint}>{copy.unknownRelease}</p>}</td>
              <td><Link className={s.url} title={entry.url} href={"/account/runs/"+entry.runId}>{compactUrl(entry.url)}</Link>{entry.batchId&&<p className={s.hint}>{clarity.domainBatch}</p>}<details className={s.identifiers}><summary>{clarity.identifiers}</summary><p>{copy.analysis} #{entry.runId}</p>{entry.batchId&&<p>{copy.batch} #{entry.batchId}</p>}</details>{entry.period!==data.period&&<p className={s.hint}>{copy.carried+" · "+entry.period}</p>}</td>
              <td><StatusBadge tone={entry.state==="COUNTED" ? "success":entry.state==="RESERVED" ? "warning":"neutral"}>{stateLabels[entry.state]}</StatusBadge></td>
              <td>{entry.state==="COUNTED" ? "1":entry.state==="RESERVED" ? copy.oneReserved:copy.noneConsumed}</td>
            </tr>)}</DataTable>}
            <nav className={s.pagination} aria-label={copy.pagination}><p>{data.items.length ? `${number(data.offset+1)}–${number(Math.min(data.total,data.offset+data.items.length))} / ${number(data.total)}`:copy.noEntries}</p><div className={c.actions}><button className={c.secondary} disabled={!offset||loading} onClick={()=>navigate(data.period,Math.max(0,offset-limit))}>{copy.previous}</button><button className={c.secondary} disabled={offset+data.items.length>=data.total||loading} onClick={()=>navigate(data.period,offset+limit)}>{copy.next}</button></div></nav>
          </>}
        </>}
      </section>
    </>}
  </main>;
}
