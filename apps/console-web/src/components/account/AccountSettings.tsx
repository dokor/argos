"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError, type AccountProfile } from "@/lib/account-client";
import { oauthCallbackError } from "@/lib/oauth-callback-error";
import { PageHeading, EmptyState, StatusBadge } from "@/components/connected/Primitives";
import { useAccountSession } from "./AccountSession";
import SocialProviderLogo, { socialProviderNames } from "./SocialProviderLogo";
import UsagePanel from "./UsagePanel";
import ConfirmAccountAction from "./ConfirmAccountAction";
import s from "./AccountSettings.module.scss";
import c from "@/components/connected/Connected.module.scss";

type Method = { id: string; provider: string };
type Session = { id: string; createdAt: string; current: boolean };
type Data = { profile: AccountProfile; methods: Method[]; sessions: Session[]; providers: string[] };
type Action = { title: string; description: string; run: () => Promise<void>; archive?: boolean };
export default function AccountSettings() {
  const {t,lang}=useLang(), a=t.account, copy=t.accountSettings;
  const router=useRouter(), params=useSearchParams(), shared=useAccountSession();
  const {invalidate}=shared;
  const section=params.get("section")==="security" ? "security" : params.get("section")==="connections" ? "connections" : "profile";
  const [data,setData]=useState<Data|null>(null),[failure,setFailure]=useState(""),[revision,setRevision]=useState(0);
  const [name,setName]=useState(""),[email,setEmail]=useState(""),[password,setPassword]=useState("");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [action,setAction]=useState<Action|null>(null);
  const lock=useRef(false),alive=useRef(false);
  useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
  useEffect(()=>{window.dispatchEvent(new Event("argos-reading"));queueMicrotask(()=>{setError("");setMessage("");setPassword("");setAction(null);});},[section]);
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    async function load() {
      try {
        const profile=await accountFetch<AccountProfile>("me","GET",undefined,controller.signal);
        const [catalog,methods,sessions]=await Promise.all([
          accountFetch<{providers:string[]}>("auth/providers","GET",undefined,controller.signal),
          profile.verified ? accountFetch<Method[]>("methods","GET",undefined,controller.signal) : [],
          profile.verified ? accountFetch<Session[]>("sessions","GET",undefined,controller.signal) : [],
        ]);
        if(active){setData({profile,methods,sessions,providers:catalog.providers});setName(profile.displayName);setEmail(profile.email??"");setFailure("");}
      } catch(reason) {if(active){setData(null);setFailure(reason instanceof AccountClientError ? reason.code : "account_unavailable");invalidate(reason);}}
    }
    void load();return ()=>{active=false;controller.abort();};
  },[revision,invalidate]);
  const explain=(reason:unknown)=>a.errors[(reason instanceof AccountClientError ? reason.code : "account_unavailable") as keyof typeof a.errors]??a.errors.account_unavailable;
  const refresh=()=>setRevision(v=>v+1);
  async function act(work:()=>Promise<void>) {
    if(lock.current)return;lock.current=true;setBusy(true);setMessage("");setError("");
    try {await work();} catch(reason){if(alive.current){setError(explain(reason));invalidate(reason);}} finally {lock.current=false;if(alive.current)setBusy(false);}
  }
  const callbackError=params.get("error");
  const callbackMessage=callbackError===null ? "" : a.errors[oauthCallbackError(callbackError)];
  const loggedOut=()=>{if(alive.current){window.dispatchEvent(new Event("argos-account-invalid"));router.push(localizedPath("/account/sign-in",lang));}};
  const complete=()=>{if(alive.current){setMessage(a.done);refresh();}};
  const request=(next:Action)=>{setError("");setMessage("");setAction(next);};
  const label=(provider:string)=>provider==="password" ? a.password : socialProviderNames[provider]??provider;
  const usable=(method:Method)=>method.provider==="password" || !!data?.providers.includes(method.provider);
  const canRemove=(method:Method)=>!!data?.methods.some(other=>other.id!==method.id&&usable(other));
  const remove=(method:Method)=>request({title:a.remove+" · "+label(method.provider),description:copy.removeHint,run:async()=>{await accountFetch("methods/"+method.id+"/remove","POST",{confirmed:true});complete();}});
  const archive=()=>request({title:a.archive,description:a.archiveHint+" "+copy.archiveDetail,archive:true,run:async()=>{await accountFetch("me/archive","POST",{confirmed:true});loggedOut();}});
  return <main className={c.page}>
    <PageHeading title={a.title} description={copy.intro}/>
    <nav className={s.tabs} aria-label={copy.navigation}>{(["profile","security","connections"] as const).map(key=><Link key={key} href={"/account/settings?section="+key} aria-current={section===key ? "page" : undefined}>{copy[key]}</Link>)}</nav>
    {shared.denied ? <EmptyState title={t.connected.sessionTitle} description={a.errors.session_invalid} kind="error"/> : failure ? <EmptyState title={t.connected.errorTitle} description={a.errors[failure as keyof typeof a.errors]??a.errors.account_unavailable} kind="error"><button className={c.secondary} onClick={refresh}>{t.connected.retry}</button></EmptyState> : !data ? <EmptyState title={t.connected.loading} kind="loading"/> : <>
      {(error||callbackMessage)&&<p className={s.error} role="alert">{error||callbackMessage}</p>}
      {message&&<p className={s.notice} role="status">{message}</p>}
      <div className={s.layout}><div className={s.content}>
        {section==="profile"&&<section className={s.panel} aria-labelledby="profile-heading"><h2 id="profile-heading">{copy.personal}</h2>
          <form className={s.form} onSubmit={event=>{event.preventDefault();void act(async()=>{await accountFetch("me","PATCH",{displayName:name});if(alive.current){window.dispatchEvent(new Event("argos-account-profile"));complete();}});}}>
            <label htmlFor="profile-name">{a.name}</label><input id="profile-name" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required maxLength={100} disabled={busy||!data.profile.verified}/>
            <label htmlFor="profile-email">{a.email}</label><input id="profile-email" value={data.profile.email??""} readOnly aria-describedby="email-description"/>
            <p id="email-description" className={s.hint}>{a.readonly}</p><div><StatusBadge tone={data.profile.verified ? "success":"warning"}>{data.profile.verified ? copy.verified:copy.pending}</StatusBadge></div>
            {data.profile.verified&&<div><button className={c.primary} disabled={busy||!name.trim()}>{busy ? a.working:a.save}</button></div>}
          </form>
          {!data.profile.verified&&<form className={s.form} onSubmit={e=>{e.preventDefault();void act(async()=>{await accountFetch("auth/confirm-email","POST",{email,returnTo:localizedPath("/account/settings",lang)});if(alive.current){setMessage(a.sent);refresh();}});}}><p>{a.pending}</p>{!data.profile.email&&<><label htmlFor="verify-email">{a.email}</label><input id="verify-email" type="email" autoComplete="email" required value={email} maxLength={254} onChange={e=>setEmail(e.target.value)}/></>}<div><button className={c.secondary} disabled={busy}>{a.resend}</button></div></form>}
        </section>}
        {section==="security"&&<>
          {data.profile.verified ? <><section className={s.panel}><h2>{a.password}</h2><p className={s.hint}>{data.methods.some(m=>m.provider==="password") ? copy.passwordChange:copy.passwordAbsent}</p>
            <form className={s.form} onSubmit={e=>{e.preventDefault();request({title:copy.savePassword,description:copy.passwordEffect,run:async()=>{await accountFetch("methods/password","POST",{password});if(alive.current){setPassword("");complete();}}});}}>
              <label htmlFor="new-password">{copy.newPassword}</label><input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required maxLength={256} aria-describedby="password-policy"/><p className={s.hint} id="password-policy">{a.passwordHint}</p><div><button className={c.primary}>{copy.savePassword}</button></div>
            </form>
            {data.methods.filter(m=>m.provider==="password").map(m=><div className={s.row} key={m.id}><span className={s.hint}>{canRemove(m) ? copy.removeHint:copy.lastMethod}</span><button className={c.secondary} disabled={!canRemove(m)} onClick={()=>remove(m)}>{copy.removePassword}</button></div>)}
          </section>
          <section className={s.panel}><h2>{copy.activeSessions}</h2><p className={s.hint}>{copy.sessionsHint}</p><ul className={s.list}>{data.sessions.map(session=><li className={s.row} key={session.id}><div><strong>{session.current ? a.current:copy.otherSession}</strong><p className={s.hint}>{copy.created} <time dateTime={session.createdAt}>{new Date(session.createdAt).toLocaleString(lang)}</time></p></div>{session.current ? <StatusBadge tone="success">{copy.thisDevice}</StatusBadge> : <button className={c.secondary} aria-label={a.revoke+" · "+new Date(session.createdAt).toLocaleString(lang)} onClick={()=>request({title:a.revoke,description:copy.revokeHint,run:async()=>{await accountFetch("sessions/"+session.id,"DELETE",{});complete();}})}>{a.revoke}</button>}</li>)}</ul>
            <button className={c.secondary} disabled={!data.sessions.some(ss=>!ss.current)} onClick={()=>request({title:a.others,description:copy.revokeHint,run:async()=>{await accountFetch("sessions/revoke-others","POST",{});complete();}})}>{a.others}</button>
          </section></> : <section className={s.panel}><h2>{copy.pending}</h2><p>{a.pending}</p><Link className={s.link} href="/account/settings?section=profile">{copy.profile}</Link></section>}
          <section className={`${s.panel} ${s.danger}`}><h2>{a.archive}</h2><p>{a.archiveHint}</p><button className={c.secondary} onClick={archive}>{a.archive}</button></section>
        </>}
        {section==="connections"&&<section className={s.panel}><h2>{copy.associated}</h2><p className={s.hint}>{copy.connectionsHint}</p>
          {!data.profile.verified ? <p>{a.pending}</p> : <>
            <ul className={s.list}>{Array.from(new Set([...data.providers,...data.methods.filter(m=>m.provider!=="password").map(m=>m.provider)])).map(provider=>{const method=data.methods.find(m=>m.provider===provider),configured=data.providers.includes(provider);return <li className={s.row} key={provider}><div className={s.provider}><SocialProviderLogo provider={provider}/><div><h3>{label(provider)}</h3><p className={s.hint}>{!configured ? copy.providerUnavailable:method ? copy.linked:copy.unlinked}</p>{method&&!canRemove(method)&&<p className={s.hint}>{copy.lastMethod}</p>}</div></div>{method ? <button className={c.secondary} disabled={!canRemove(method)} onClick={()=>remove(method)} aria-label={a.remove+" "+label(provider)}>{a.remove}</button> : <button className={c.secondary} onClick={()=>request({title:a.add+" "+label(provider),description:copy.linkHint,run:async()=>{const result=await accountFetch<{url:string}>("auth/oauth/"+provider+"/start","POST",{intent:"link",returnTo:localizedPath("/account/settings?section=connections",lang)});if(alive.current)window.location.assign(result.url);}})} aria-label={a.add+" "+label(provider)}>{a.add}</button>}</li>;})}</ul>
            {!data.providers.length&&!data.methods.some(m=>m.provider!=="password")&&<p className={s.notice}>{copy.noProviders}</p>}
            <p className={s.hint}>{copy.providerHint}</p>
          </>}
        </section>}
      </div><aside className={s.summary} aria-label={copy.summary}><span className={s.avatar} aria-hidden="true">{data.profile.displayName.slice(0,1).toUpperCase()}</span><h2>{data.profile.displayName}</h2><p>{data.profile.email??copy.emailAbsent}</p><StatusBadge tone={data.profile.verified ? "success":"warning"}>{data.profile.verified ? copy.verified:copy.pending}</StatusBadge><p className={s.hint}>{t.connected.personalSpace}</p><button className={c.secondary} disabled={busy} onClick={()=>void act(async()=>{await accountFetch("auth/logout","POST",{});loggedOut();})}>{a.logout}</button><Link className={s.link} href="/account/sites">{a.sites.title}</Link></aside></div>
      {section==="profile"&&data.profile.verified&&<div className={s.usage}><UsagePanel/></div>}
      {action&&<ConfirmAccountAction title={action.title} description={action.description} archive={action.archive} hasPassword={!data.profile.verified||data.methods.some(m=>m.provider==="password")} hasEmail={!!data.profile.email} onCancel={()=>setAction(null)} onConfirm={async()=>{await action.run();if(alive.current)setAction(null);}}/>}
    </>}
  </main>;
}
