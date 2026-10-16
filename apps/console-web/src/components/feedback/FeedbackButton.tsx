"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { FeedbackReference } from "@/lib/feedback-request";
import Dialog from "@/components/ui/Dialog";
import FeedbackForm from "./FeedbackForm";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";
export default function FeedbackButton({type="SUGGESTION",reference,findingKey,children,className}:{type?:string;reference?:FeedbackReference;findingKey?:string;children?:React.ReactNode;className?:string}) {
  const {lang}=useLang(),c=feedbackCopy[lang];
  const [open,setOpen]=useState(false),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
  const keepButton=useRef<HTMLButtonElement>(null), formArea=useRef<HTMLDivElement>(null), wasConfirm=useRef(false);
  useEffect(()=>{
    if(confirm) keepButton.current?.focus();
    else if(wasConfirm.current) formArea.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    wasConfirm.current=confirm;
  },[confirm]);
  const close=()=>{if(busy)return;if(dirty)setConfirm(true);else setOpen(false);};
  return <><button type="button" className={className} aria-haspopup="dialog" onClick={()=>{setOpen(true);setDirty(false);setConfirm(false);}}>{children ?? (findingKey ? c.falsePositive : c.title)}</button>
    {open && <Dialog title={c.title} closeLabel={c.cancel} onClose={close}>
      <p>{c.intro}</p>
      {confirm ? <div className={s.form}><p role="alert">{c.discard}</p><div className={s.actions}><button ref={keepButton} type="button" onClick={()=>setConfirm(false)}>{c.keep}</button><button type="button" onClick={()=>setOpen(false)}>{c.discardAction}</button></div></div> : null}
      <div ref={formArea} hidden={confirm}><FeedbackForm reference={reference} findingKey={findingKey} initialType={findingKey ? "FALSE_POSITIVE" : type} onDirty={()=>setDirty(true)} onSent={()=>setDirty(false)} onBusy={setBusy}/></div>
      <button className={s.trigger} type="button" disabled={busy} onClick={close}>{c.cancel}</button>
    </Dialog>}
  </>;
}
