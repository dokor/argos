"use client";
import { inputHints } from "@/lib/input-hints";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "./AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import Link from "@/components/LocalizedLink";
import { historyCopy } from "./historyCopy";
import { PageHeading, DataTable, StatusBadge, EmptyState } from "@/components/connected/Primitives";
import AnalysisNavigation from "@/components/connected/AnalysisNavigation";
import { analysisCopy } from "@/components/connected/analysisCopy";
import s from "@/components/connected/Analysis.module.scss";
import ui from "@/components/connected/Connected.module.scss";
type Site={siteId:string;hostname:string;urlCount:number;latestActivityAt:string|null;latestRunStatus:string|null};
type SiteUrl={siteUrlId:string;auditId:string;normalizedUrl:string;latestAttempt:{runId:string;status:string;createdAt:string;finishedAt:string|null}|null;latestAvailableReport:{runId:string;publishedAt:string;expiresAt:string|null;globalScore:number|null;provisional:boolean|null}|null};
type Page<T>={items:T[];nextCursor:string|null};
export default function SitesView({siteId}:{siteId?:string}) {
  const {t,lang}=useLang(),copy=t.account.sites,c=analysisCopy[lang],session=useAccountSession(),router=useRouter(),params=useSearchParams();
  const query=params.get("q")??"",cursor=params.get("cursor"),base="/account/sites"+(siteId ? "/"+siteId : "");
  const [search,setSearch]=useState(query),[site,setSite]=useState<Site|null>(null),[sites,setSites]=useState<Site[]>([]),[urls,setUrls]=useState<SiteUrl[]>([]);
  const [next,setNext]=useState<string|null>(null),[revision,setRevision]=useState(0),[loadedFor,setLoadedFor]=useState("");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[formError,setFormError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[url,setUrl]=useState("");
  const input=useRef<HTMLInputElement>(null),submitting=useRef(false);
  const allowed=session.profile?.verified && !session.denied,invalidate=session.invalidate;
  const selection=base+"?"+query+"&"+cursor;
  useEffect(()=>{
    if(!session.ready || !allowed) return;
    let alive=true;const controller=new AbortController();
    queueMicrotask(()=>{if(alive){setLoading(true);setError("");setSearch(query);}});
    const filter=new URLSearchParams();if(cursor) filter.set("cursor",cursor);if(query) filter.set("q",query);
    const suffix=filter.size ? "?"+filter : "";
    const read=async()=>{
      try {
        if(siteId) { const [detail,page]=await Promise.all([accountFetch<Site>("sites/"+siteId,"GET",undefined,controller.signal),accountFetch<Page<SiteUrl>>("sites/"+siteId+"/urls"+suffix,"GET",undefined,controller.signal)]); if(alive){setSite(detail);setUrls(page.items);setNext(page.nextCursor);} }
        else {const page=await accountFetch<Page<Site>>("sites"+suffix,"GET",undefined,controller.signal);if(alive){setSites(page.items);setSite(null);setNext(page.nextCursor);}}
      } catch(reason) {if(alive){invalidate(reason);setSites([]);setUrls([]);setSite(null);setNext(null);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");}}
      finally {if(alive){setLoading(false);setLoadedFor(selection);}}
    };
    void read(); return ()=>{alive=false;controller.abort();};
  },[siteId,cursor,query,revision,allowed,session.ready,invalidate,selection]);
  useEffect(()=>{
    if(session.ready && session.denied) router.replace(localizedPath("/account/sign-in",lang)+"?returnTo="+encodeURIComponent(localizedPath(base,lang)));
  },[session.ready,session.denied,router,lang,base]);
  const navigate=(term:string,after?:string)=>{const filter=new URLSearchParams();if(term.trim()) filter.set("q",term.trim());if(after) filter.set("cursor",after);router.push(localizedPath(base,lang)+(filter.size ? "?"+filter : ""));};
  async function add(event:FormEvent) {
    event.preventDefault(); if(submitting.current) return;submitting.current=true;setBusy(true);setFormError("");setMessage("");
    try {
      const result=await accountFetch<{site:Site;created:boolean}>(siteId ? "sites/"+siteId+"/urls" : "sites","POST",{url});
      setMessage(result.created ? copy.added : copy.existing);setUrl("");
      if(!siteId) router.push(localizedPath("/account/sites/"+result.site.siteId,lang));
      else {navigate("");setRevision(v=>v+1);}
    } catch(reason){invalidate(reason);setFormError(reason instanceof AccountClientError ? reason.code : "account_unavailable");input.current?.focus();}
    finally{submitting.current=false;setBusy(false);}
  }
  const date=(raw:string|null)=>raw ? new Date(raw).toLocaleString(lang) : copy.none;
  const status=(raw:string|null)=>raw ? t.account.statuses[raw as keyof typeof t.account.statuses] ?? t.account.working : copy.none;
  const failure=t.account.errors[error as keyof typeof t.account.errors] ?? t.account.errors.account_unavailable;
  const formFailure=formError==="hostname_mismatch" ? copy.mismatch : t.account.errors[formError as keyof typeof t.account.errors] ?? t.account.errors.account_unavailable;
  const reading=loading||loadedFor!==selection;
  return <main className={ui.page}>
    {siteId && <Link href="/account/sites">{c.sites}</Link>}
    <PageHeading title={allowed && site && loadedFor===selection ? site.hostname : c.title} description={c.intro} action={<Link className={ui.primary} href="/account/analyses/new">{c.fresh}</Link>}/>
    <AnalysisNavigation active="sites"/>
    {!session.ready && <p role="status">{t.account.working}</p>}
    {session.ready && !session.profile && !session.denied && <p role="alert">{t.account.errors.account_unavailable}</p>}
    {session.profile && !session.profile.verified && <><p>{t.account.pending}</p><Link href="/account">{t.account.verify}</Link></>}
    {allowed && <>
      <form className={s.search} onSubmit={event=>{event.preventDefault();navigate(search);}}><label htmlFor="site-search">{siteId ? c.searchUrls : c.searchSites}<input id="site-search" placeholder={siteId ? inputHints[lang].searchUrl : inputHints[lang].searchSite} value={search} maxLength={200} onChange={event=>setSearch(event.target.value)}/></label><button className={ui.secondary}>{c.search}</button>{query && <button className={ui.secondary} type="button" onClick={()=>navigate("")}>{c.reset}</button>}<button className={ui.secondary} type="button" disabled={reading} onClick={()=>setRevision(v=>v+1)}>{copy.refresh}</button></form>
      {error && <EmptyState kind="error" title={failure}><button className={ui.secondary} onClick={()=>setRevision(v=>v+1)}>{copy.retry}</button></EmptyState>}
      {reading ? <p role="status">{t.account.working}</p> : !error && !siteId ? <>
        {sites.length===0 ? <EmptyState title={query ? c.noResults : copy.empty} description={copy.intro}/> : <DataTable caption={c.sites} columns={[c.sites,copy.urls,copy.latest]}>{sites.map(item=><tr key={item.siteId}><td><Link href={"/account/sites/"+item.siteId}>{item.hostname}</Link></td><td>{item.urlCount}</td><td><StatusBadge tone={item.latestRunStatus==="FAILED" ? "danger" : "neutral"}>{status(item.latestRunStatus)}</StatusBadge><p>{date(item.latestActivityAt)}</p></td></tr>)}</DataTable>}
      </> : !error && <>
        {!urls.length && <EmptyState title={query ? c.noResults : copy.none}/>}
        <ul className={s.urlList}>{urls.map(item=><li key={item.siteUrlId}>
          <h2>{item.normalizedUrl}</h2><div className={s.attempts}><section><h3>{copy.latest}</h3>
          {item.latestAttempt ? <><StatusBadge tone={item.latestAttempt.status==="FAILED" ? "danger" : "neutral"}>{status(item.latestAttempt.status)}</StatusBadge><p>{date(item.latestAttempt.createdAt)}</p><Link href={"/account/runs/"+item.latestAttempt.runId}>{copy.progress}</Link></> : <p>{copy.none}</p>}</section>
          <section><h3>{copy.report}</h3>{item.latestAvailableReport ? <><strong>{item.latestAvailableReport.globalScore===null ? copy.scoreUnavailable : item.latestAvailableReport.globalScore+"/100"}</strong><p>{date(item.latestAvailableReport.publishedAt)}</p>{item.latestAvailableReport.provisional && <StatusBadge tone="warning">{copy.partial}</StatusBadge>}{item.latestAvailableReport.provisional===null && <p>{copy.unknown}</p>}<p><Link href={"/account/runs/"+item.latestAvailableReport.runId}>{t.account.openReport}</Link></p></> : <p>{copy.unavailable}</p>}</section></div>
          <div className={ui.actions}><Link className={ui.secondary} href={"/account/urls/"+item.siteUrlId+"/history"}>{historyCopy[lang].title}</Link><Link className={ui.primary} href={"/account/analyses/new?url="+encodeURIComponent(item.normalizedUrl)}>{copy.again}</Link></div>
        </li>)}</ul>
      </>}
      <div className={ui.actions}>{cursor && <button className={ui.secondary} onClick={()=>navigate(query)}>{c.sites}</button>}{next && !reading && <button className={ui.secondary} onClick={()=>navigate(query,next)}>{copy.next}</button>}</div>
      <details className={s.follow}><summary>{siteId ? copy.addUrl : copy.add}</summary><p id="follow-hint">{copy.hint} {copy.noAudit}</p>
        <form className={s.form} onSubmit={add}><label htmlFor="follow-url">{copy.url}<input ref={input} id="follow-url" placeholder={inputHints[lang].url} inputMode="url" value={url} onChange={e=>setUrl(e.target.value)} maxLength={2048} required disabled={busy} aria-describedby="follow-hint follow-feedback" aria-invalid={Boolean(formError)}/></label><button className={ui.secondary} disabled={busy}>{busy ? t.account.working : siteId ? copy.addUrl : copy.add}</button></form>
        <p id="follow-feedback" role={formError ? "alert" : "status"}>{formError ? formFailure : message}</p>
        {formError==="hostname_mismatch" && <Link href="/account/sites">{copy.add}</Link>}
      </details>
    </>}
  </main>;
}
