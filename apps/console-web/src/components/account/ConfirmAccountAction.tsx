"use client";
import { useEffect, useRef, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AccountSettings.module.scss";
import c from "@/components/connected/Connected.module.scss";

export default function ConfirmAccountAction({title,description,archive=false,hasPassword,hasEmail,onConfirm,onCancel}:{title:string;description:string;archive?:boolean;hasPassword:boolean;hasEmail:boolean;onConfirm:()=>Promise<void>;onCancel:()=>void}) {
  const {t}=useLang(),a=t.account,copy=t.accountSettings;
  const dialog=useRef<HTMLDialogElement>(null),alive=useRef(false),lock=useRef(false);
  const [password,setPassword]=useState(""),[code,setCode]=useState(""),[viaCode,setViaCode]=useState(!hasPassword);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[confirmed,setConfirmed]=useState(false);
  useEffect(()=>{alive.current=true;const trigger=document.activeElement as HTMLElement|null;const element=dialog.current;element?.showModal();return()=>{alive.current=false;element?.close();if(trigger?.isConnected)trigger.focus();};},[]);
  async function act(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError("");setMessage("");try{await work();}catch(reason){if(alive.current)setError(a.errors[(reason instanceof AccountClientError ? reason.code:"account_unavailable") as keyof typeof a.errors]??a.errors.account_unavailable);}finally{lock.current=false;if(alive.current)setBusy(false);}}
  return <dialog ref={dialog} className={s.dialog} aria-labelledby="confirm-title" aria-describedby="confirm-description" onCancel={e=>{e.preventDefault();if(!lock.current)onCancel();}}>
    <h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p>
    <form className={s.form} onSubmit={e=>{e.preventDefault();if(archive&&!confirmed)return;void act(async()=>{await accountFetch("auth/reauth","POST",viaCode ? {code}:{password});setPassword("");setCode("");if(alive.current)await onConfirm();});}}>
      <p className={s.hint}>{copy.confirmHint}</p>
      {viaCode ? <><label htmlFor="reauth-code">{a.code}</label><input id="reauth-code" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} maxLength={43} required disabled={busy}/><div><button className={c.secondary} type="button" disabled={busy||!hasEmail} onClick={()=>void act(async()=>{await accountFetch("auth/reauth","POST",{});if(alive.current)setMessage(a.sent);})}>{a.sendCode}</button></div></> : <><label htmlFor="reauth-password">{copy.currentPassword}</label><input id="reauth-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={256} required disabled={busy}/></>}
      {hasPassword&&hasEmail&&<button type="button" className={s.linkButton} disabled={busy} onClick={()=>{setViaCode(!viaCode);setPassword("");setCode("");setError("");}}>{viaCode ? copy.usePassword:copy.useCode}</button>}
      {!hasEmail&&viaCode&&<p className={s.error}>{a.errors.email_required}</p>}
      {archive&&<label className={s.check}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} disabled={busy}/>{a.confirmArchive}</label>}
      {error&&<p className={s.error} role="alert">{error}</p>}{message&&<p className={s.notice} role="status">{message}</p>}
      <div className={s.actions}><button className={c.secondary} type="button" disabled={busy} onClick={onCancel}>{copy.cancel}</button><button className={c.primary} disabled={busy||(archive&&!confirmed)||(viaCode ? !code:!password)}>{busy ? a.working:copy.confirmAction}</button></div>
    </form>
  </dialog>;
}
