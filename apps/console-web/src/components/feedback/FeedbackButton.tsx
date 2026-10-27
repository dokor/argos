"use client";
import { lazy, Suspense, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { FeedbackReference } from "@/lib/feedback-request";
import { feedbackCopy } from "./copy";
import buttonStyles from "./FeedbackButton.module.scss";
const FeedbackDialog = lazy(() => import("./FeedbackDialog"));
export default function FeedbackButton({type="SUGGESTION",reference,findingKey,children,className,variant="text"}:{type?:string;reference?:FeedbackReference;findingKey?:string;children?:React.ReactNode;className?:string;variant?:"text"|"icon"}) {
  const {lang}=useLang(),c=feedbackCopy[lang];
  const [open,setOpen]=useState(false);
  const label=findingKey ? c.falsePositive : c.title;
  return <><button type="button" className={[variant==="icon" ? buttonStyles.icon : "",className].filter(Boolean).join(" ")} aria-label={variant==="icon" ? label : undefined} title={variant==="icon" ? label : undefined} aria-haspopup="dialog" onClick={()=>setOpen(true)}>{variant==="icon" ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8M8 14h5"/></svg> : children ?? label}</button>
    {open && <Suspense fallback={<span className={buttonStyles.loading} role="status">{c.title}…</span>}>
      <FeedbackDialog type={type} reference={reference} findingKey={findingKey} onClose={()=>setOpen(false)} />
    </Suspense>}
  </>;
}
