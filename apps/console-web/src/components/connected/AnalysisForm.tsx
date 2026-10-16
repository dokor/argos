"use client";
import { inputHints } from "@/lib/input-hints";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession } from "@/components/account/AccountSession";
import { analysisCopy } from "./analysisCopy";
import { pendingAnalysis, rememberAnalysis, forgetAnalysis, type PendingAnalysis } from "@/lib/connected/analysis-recovery";
import s from "./Analysis.module.scss";
import ui from "./Connected.module.scss";
import type { AnalysisProfiles as Profiles, SiteAnalysisAccepted } from "@/lib/connected/contracts";
export default function AnalysisForm({ initialUrl="", launchBlocked=false }: {initialUrl?:string;launchBlocked?:boolean}) {
  const {t,lang}=useLang(),c=analysisCopy[lang],session=useAccountSession(),router=useRouter();
  const [url,setUrl]=useState(initialUrl),[profiles,setProfiles]=useState<Profiles|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[uncertain,setUncertain]=useState(false);
  const mounted=useRef(false);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  const submitting=useRef(false),request=useRef<PendingAnalysis|null>(null),input=useRef<HTMLInputElement>(null);
  const allowed=session.profile?.verified && !session.denied, invalidate=session.invalidate;
  useEffect(()=>{
    if(!allowed) return;
    let alive=true;const controller=new AbortController();
    async function load() {
      try {
        const pending=pendingAnalysis();
        if(pending) {request.current=pending;setUrl(pending.url);setUncertain(true);setBusy(true);}
        const data=await accountFetch<Profiles>("analysis-profiles","GET",undefined,controller.signal);
        if(!alive)return;
        if(!data.items?.some(item=>item.id===data.defaultProfileId)) throw new Error("Invalid profile catalogue");
        setProfiles(data);setError("");
        if(pending) {
          try {
            const run=await accountFetch<SiteAnalysisAccepted>("analyses/"+pending.key,"GET",undefined,controller.signal);
            if(!/^[1-9]\d{0,18}$/.test(run.runId))throw new Error("Invalid recovery response");
            if(!alive)return;
            forgetAnalysis(pending.key);
            window.dispatchEvent(new Event("argos-usage-refresh"));
            router.push(localizedPath("/account/runs/"+run.runId,lang));
            return;
          } catch(reason) {
            if(!alive)return;
            // Keep the original key if not admitted, without automatically creating a run.
            if(!(reason instanceof AccountClientError) || reason.status!==404)throw reason;
          }
        }
      } catch(reason) {if(alive){invalidate(reason);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");}}
      if(alive)setBusy(false);
    }
    void load();
    return ()=>{alive=false;controller.abort();};
  },[allowed,revision,invalidate,router,lang]);
  async function submit(event:FormEvent) {
    event.preventDefault();
    if(submitting.current || !allowed || !profiles || (!uncertain && (!session.usage?.canLaunch || launchBlocked))) return;
    submitting.current=true;setBusy(true);setError("");
    const value=url.trim(),profileId=uncertain&&request.current ? request.current.profileId : profiles.defaultProfileId;
    if(!request.current || request.current.url!==value || request.current.profileId!==profileId) request.current={url:value,profileId,key:crypto.randomUUID()};
    try {
      rememberAnalysis(request.current);
      const run=await accountFetch<SiteAnalysisAccepted>("analyses","POST",{url:value,profileId},undefined,request.current.key);
      if(!/^[1-9]\d{0,18}$/.test(run.runId)) throw new Error("Invalid admission response");
      window.dispatchEvent(new Event("argos-usage-refresh"));
      if(mounted.current) {forgetAnalysis(request.current.key);router.push(localizedPath("/account/runs/"+run.runId,lang));}
      // Keep the guard until navigation unmounts this form.
    } catch(reason) {
      invalidate(reason);if(!mounted.current) return;const code=reason instanceof AccountClientError ? reason.code : "account_unavailable";
      if(code==="unsupported_profile") setProfiles(null);
      setError(code);setUncertain(!(reason instanceof AccountClientError) || reason.status>=500);
      if(reason instanceof AccountClientError && reason.status<500) {forgetAnalysis(request.current!.key);request.current=null;window.dispatchEvent(new Event("argos-usage-refresh"));}
      submitting.current=false;setBusy(false);input.current?.focus();
    }
  }
  const failure=error==="unsupported_profile" ? c.unsupported : error==="idempotency_conflict" ? c.conflict : t.account.errors[error as keyof typeof t.account.errors]??t.account.errors.account_unavailable;
  return <form className={s.form} onSubmit={submit} aria-busy={busy}>
    <label htmlFor="analysis-url">{c.url}<input id="analysis-url" placeholder={inputHints[lang].url} ref={input} inputMode="url" autoComplete="url" value={url} maxLength={2048} required readOnly={busy||uncertain} onChange={event=>setUrl(event.target.value)} aria-describedby="analysis-scope analysis-feedback" aria-invalid={error==="url_invalid"}/></label>
    <p id="analysis-scope">{c.scope}</p>
    <div><h3>{c.conditions}</h3>{profiles ? <><p>{c.defaults} · <code>{profiles.defaultProfileId}</code></p><p>{c.profileHint}</p></> : <p role="status">{t.account.working}</p>}</div>
    <div className={s.notice}><h3>{c.cost}</h3><p>{c.costHint}</p>{!session.usage && <p>{c.quotaUnknown}</p>}{session.usage?.canLaunch===false && !uncertain && <p>{t.account.usage.reached}</p>}</div>
    <p id="analysis-feedback" role={error ? "alert" : "status"} className={error ? s.error : undefined}>{error ? failure : ""}{uncertain && <> {c.recovery}</>}</p>
    {!profiles && error && <button className={ui.secondary} type="button" onClick={()=>setRevision(v=>v+1)}>{c.retry}</button>}
    {!session.usage && <button className={ui.secondary} type="button" onClick={session.refreshUsage}>{t.account.usage.refresh}</button>}
    <button className={ui.primary} disabled={busy||!allowed||!profiles||(!uncertain&&(!session.usage?.canLaunch||launchBlocked))}>{busy ? c.launching : uncertain ? c.retry : c.launch}</button>
    <p>{c.saved}</p>
  </form>;
}
