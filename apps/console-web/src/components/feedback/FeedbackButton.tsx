"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { FeedbackReference } from "@/lib/feedback-request";
import Dialog from "@/components/ui/Dialog";
import FeedbackForm from "./FeedbackForm";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";
import buttonStyles from "./FeedbackButton.module.scss";
export default function FeedbackButton({type="SUGGESTION",reference,findingKey,children,className,variant="text"}:{type?:string;reference?:FeedbackReference;findingKey?:string;children?:React.ReactNode;className?:string;variant?:"text"|"icon"}) {
  const {lang}=useLang(),c=feedbackCopy[lang];
  const [open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
  const keepButton=useRef<HTMLButtonElement>(null), formArea=useRef<HTMLDivElement>(null), wasConfirm=useRef(false);
  useEffect(()=>{
    if(confirm) keepButton.current?.focus();
    else if(wasConfirm.current) formArea.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    wasConfirm.current=confirm;
  },[confirm]);
  const close=()=>{if(busy)return;if(dirty)setConfirm(true);else setOpen(false);};
  const label=findingKey ? c.falsePositive : c.title;
  return <><button type="button" className={[variant==="icon" ? buttonStyles.icon : "",className].filter(Boolean).join(" ")} aria-label={variant==="icon" ? label : undefined} title={variant==="icon" ? label : undefined} aria-haspopup="dialog" onClick={()=>{setOpen(true);setDirty(false);setConfirm(false);}}>{variant==="icon" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8M8 14h5"/></svg> : children ?? label}</button>
    {open && <Dialog title={c.title} closeLabel={c.cancel} onClose={close}>
      <p>{c.intro}</p>
      {confirm ? <div className={s.form}><p role="alert">{c.discard}</p><div className={s.actions}><button ref={keepButton} type="button" onClick={()=>setConfirm(false)}>{c.keep}</button><button type="button" onClick={()=>setOpen(false)}>{c.discardAction}</button></div></div> : null}
      <div ref={formArea} hidden={confirm}><FeedbackForm reference={reference} findingKey={findingKey} initialType={findingKey ? "FALSE_POSITIVE" : type} onDirty={()=>setDirty(true)} onSent={()=>setDirty(false)} onBusy={setBusy}/></div>
      <button className={s.trigger} type="button" disabled={busy} onClick={close}>{c.cancel}</button>
    </Dialog>}
  </>;
}
