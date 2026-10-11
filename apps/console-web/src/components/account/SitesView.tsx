"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession, PersonalNavigation } from "./AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import AuditForm from "@/components/AuditForm";
import UsagePanel from "./UsagePanel";
import s from "./AccountView.module.scss";
type Site={siteId:string;hostname:string;urlCount:number;latestActivityAt:string|null;latestRunStatus:string|null};
type SiteUrl={siteUrlId:string;auditId:string;normalizedUrl:string;latestAttempt:{runId:string;status:string;createdAt:string;finishedAt:string|null}|null;latestAvailableReport:{runId:string;publishedAt:string;expiresAt:string|null;globalScore:number|null;provisional:boolean|null}|null};
type Page<T>={items:T[];nextCursor:string|null};
export default function SitesView({siteId}:{siteId?:string}) {
  const {t,lang}=useLang(),copy=t.account.sites,session=useAccountSession(),router=useRouter(),params=useSearchParams();
  const [site,setSite]=useState<Site|null>(null),[sites,setSites]=useState<Site[]>([]),[urls,setUrls]=useState<SiteUrl[]>([]);
  const [cursor,setCursor]=useState<string|null>(null),[next,setNext]=useState<string|null>(null),[revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[url,setUrl]=useState(""),[analyse,setAnalyse]=useState<string|null>(null);
  const input=useRef<HTMLInputElement>(null),submitting=useRef(false);
  const allowed=session.profile?.verified && !session.denied;
  const invalidate=session.invalidate;
  useEffect(()=>{
    if(!session.ready || !allowed) return;
    let alive=true;
    queueMicrotask(()=>{if(alive){setLoading(true);setError("");setSite(null);setSites([]);setUrls([]);}});
    const suffix=cursor ? "?cursor="+encodeURIComponent(cursor) : "";
    const read=async()=>{
      try {
        if(siteId) { const [detail,page]=await Promise.all([accountFetch<Site>("sites/"+siteId),accountFetch<Page<SiteUrl>>("sites/"+siteId+"/urls"+suffix)]); if(alive){setSite(detail);setUrls(page.items);setNext(page.nextCursor);} }
        else {const page=await accountFetch<Page<Site>>("sites"+suffix);if(alive){setSites(page.items);setNext(page.nextCursor);}}
      } catch(reason) {if(alive){invalidate(reason);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");}}
      finally {if(alive) setLoading(false);}
    };
    void read(); return ()=>{alive=false;};
  },[siteId,cursor,revision,allowed,session.ready,invalidate]);
  useEffect(()=>{
    if(session.ready && session.denied) router.replace(localizedPath("/account/sign-in",lang)+"?returnTo="+encodeURIComponent(localizedPath("/account/sites"+(siteId ? "/"+siteId : ""),lang)));
  },[session.ready,session.denied,router,lang,siteId]);
  async function add(event:FormEvent) {
    event.preventDefault(); if(submitting.current) return;submitting.current=true;setBusy(true);setError("");setMessage("");
    try {
      const result=await accountFetch<{site:Site;created:boolean}>(siteId ? "sites/"+siteId+"/urls" : "sites","POST",{url});
      setMessage(result.created ? copy.added : copy.existing);setUrl("");
      if(!siteId) router.push(localizedPath("/account/sites/"+result.site.siteId,lang));
      else {setCursor(null);setRevision(v=>v+1);}
    } catch(reason){invalidate(reason);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");input.current?.focus();}
    finally{submitting.current=false;setBusy(false);}
  }
  const date=(raw:string|null)=>raw ? new Date(raw).toLocaleString(lang) : copy.none;
  const status=(raw:string|null)=>raw ? t.account.statuses[raw as keyof typeof t.account.statuses] ?? t.account.working : copy.none;
  const failure=error==="hostname_mismatch" ? copy.mismatch : t.account.errors[error as keyof typeof t.account.errors] ?? t.account.errors.account_unavailable;
  const showAnalysis=analyse!==null || params.get("analyse")==="1";
  return <><div className={s.chrome}><SiteNav/></div><PersonalNavigation/><main className={s.page}>
    {siteId && <Link href="/account/sites">{copy.title}</Link>}
    <h1>{allowed && site ? site.hostname : copy.title}</h1>
    {!session.ready && <p role="status">{t.account.working}</p>}
    {session.ready && !session.profile && !session.denied && <p role="alert">{t.account.errors.account_unavailable}</p>}
    {session.profile && !session.profile.verified && <><p>{t.account.pending}</p><Link href="/account">{t.account.verify}</Link></>}
    {allowed && <>
      <UsagePanel/>
      <p>{copy.intro}</p><div className={s.actions}><button className={s.button} onClick={()=>setAnalyse("")}>{copy.analyse}</button><button className={s.button} onClick={()=>input.current?.focus()}>{siteId ? copy.addUrl : copy.add}</button><button className={s.button} disabled={loading} onClick={()=>setRevision(v=>v+1)}>{copy.refresh}</button></div>
      {showAnalysis && <section className={s.card}><h2>{copy.analyse}</h2><AuditForm key={analyse??"new"} mode="personal" initialUrl={analyse??""} submitLabel={copy.again} launchBlocked={session.usage?.canLaunch===false}/><p>{copy.lost}</p></section>}
      <section className={s.card}><h2>{siteId ? copy.addUrl : copy.add}</h2><p id="follow-hint">{copy.hint} {copy.noAudit}</p>
        <form className={s.form} onSubmit={add}><label htmlFor="follow-url">{copy.url}</label><input ref={input} className={s.input} id="follow-url" inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} maxLength={2048} required disabled={busy} aria-describedby="follow-hint follow-feedback" aria-invalid={Boolean(error)}/><button className={s.button} disabled={busy}>{busy ? t.account.working : siteId ? copy.addUrl : copy.add}</button></form>
        <p id="follow-feedback" role={error ? "alert" : "status"}>{error ? failure : message}</p>
        {error && <><button className={s.button} onClick={()=>setRevision(v=>v+1)}>{copy.retry}</button>{error==="hostname_mismatch" && <Link href="/account/sites">{copy.add}</Link>}</>}
      </section>
      {loading ? <p role="status">{t.account.working}</p> : !siteId ? <>
        {sites.length===0 && !error && <p>{copy.empty}</p>}
        <ul className={s.list}>{sites.map(item=><li key={item.siteId}><div><Link href={"/account/sites/"+item.siteId}>{item.hostname}</Link><p>{item.urlCount} {copy.urls}</p><p>{date(item.latestActivityAt)} — {status(item.latestRunStatus)}</p></div></li>)}</ul>
      </> : <ul className={s.urlList}>{urls.map(item=><li className={s.card} key={item.siteUrlId}>
        <h2>{item.normalizedUrl}</h2><h3>{copy.latest}</h3>
        {item.latestAttempt ? <><p>{date(item.latestAttempt.createdAt)} — {status(item.latestAttempt.status)}</p><Link href={"/account/runs/"+item.latestAttempt.runId}>{copy.progress}</Link></> : <p>{copy.none}</p>}
        <h3>{copy.report}</h3>{item.latestAvailableReport ? <><p>{date(item.latestAvailableReport.publishedAt)} — {item.latestAvailableReport.globalScore===null ? copy.scoreUnavailable : item.latestAvailableReport.globalScore+"/100"}</p>{item.latestAvailableReport.provisional && <p>{copy.partial}</p>}{item.latestAvailableReport.provisional===null && <p>{copy.unknown}</p>}<Link href={"/account/runs/"+item.latestAvailableReport.runId}>{t.account.openReport}</Link></> : <p>{copy.unavailable}</p>}
        <div className={s.actions}><button className={s.button} onClick={()=>{setAnalyse(item.normalizedUrl);window.scrollTo({top:0});}}>{copy.again}</button></div>
      </li>)}</ul>}
      {next && !loading && <button className={s.button} onClick={()=>setCursor(next)}>{copy.next}</button>}
    </>}
  </main><SiteFooter/></>;
}
