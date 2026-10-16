"use client";
import { useId, useState, useRef, useEffect, type FormEvent } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { accountAuditHeaders } from "@/lib/account-client";
import type { FeedbackReference } from "@/lib/feedback-request";
import { useAntiBot } from "@/components/security/useAntiBot";
import { feedbackPayload } from "@/lib/feedback-request";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";

export default function FeedbackForm({ reference, findingKey, initialType, onDirty, onSent, onBusy }: { reference?: FeedbackReference; findingKey?: string; initialType?:string; onDirty?:()=>void; onSent?:()=>void; onBusy?:(busy:boolean)=>void }) {
  const { lang, t } = useLang(), c = feedbackCopy[lang], id = useId();
  const [type, setType] = useState(initialType ?? (findingKey ? "FALSE_POSITIVE" : "SUGGESTION")), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  const receipt=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(sent)receipt.current?.focus();},[sent]);
  const lock=useRef(false), antiBot=useAntiBot("feedback");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(lock.current) return; const values = new FormData(event.currentTarget);
    lock.current=true;setBusy(true);onBusy?.(true); setError("");
    const body: Record<string, unknown> = { type, description: values.get("description"), website: values.get("website") };
    if(values.get("urls"))body.urls=values.get("urls");
    if (values.get("page")) body.page = values.get("page");
    if (type === "BUG") for (const key of ["expected", "observed", "steps"]) if (values.get(key)) body[key] = values.get(key);
    if (reference && values.get("attach") === "on") Object.assign(body, reference);
    if (findingKey && type === "FALSE_POSITIVE") body.findingKey = findingKey;
    try {
      if(!feedbackPayload(body)) {setError(c.invalid);return;}
      const captcha=await antiBot.verify();
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", ...await accountAuditHeaders(), ...(captcha ? {"X-Argos-Captcha":captcha} : {}) }, body: JSON.stringify(body), signal:AbortSignal.timeout(15000), cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.accepted === true) {setSent(true);onSent?.();}
      else setError(result.error === "antibot_invalid" ? t.account.errors.antibot_invalid : result.error === "antibot_unavailable" ? t.account.errors.antibot_unavailable : response.status === 429 ? c.limited + (response.headers.get("retry-after") ?? "900") : response.status === 404 ? c.unavailable : response.status === 400 ? c.invalid : c.error);
    } catch { setError(c.error); }
    finally { lock.current=false;setBusy(false);onBusy?.(false); }
  }
  if (sent) return <p ref={receipt} tabIndex={-1} role="status">{c.received}</p>;
  return <form method="post" className={s.form} onSubmit={submit} onChange={onDirty} aria-describedby={id + "-privacy"}>
    <p id={id + "-privacy"}>{c.privacy}</p>
    {findingKey && <p>{c.finding}: <code>{findingKey}</code></p>}<label>{c.type}<select value={type} onChange={event => setType(event.target.value)}><option value="SUGGESTION">{c.types.SUGGESTION}</option><option value="BUG">{c.types.BUG}</option><option value="FALSE_POSITIVE">{c.types.FALSE_POSITIVE}</option></select></label>
    {type === "FALSE_POSITIVE" && <p>{findingKey ? c.reference : c.findingHelp}</p>}
    <label>{c.description}<textarea name="description" required maxLength={4000} rows={5} aria-describedby={id+"-description"} /></label><p id={id+"-description"}>{c.descriptionHint}</p>
    {!findingKey && <label>{c.page}<select name="page" defaultValue=""><option value="">—</option>{Object.entries(c.pages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    <label>{c.urls}<textarea name="urls" rows={2} maxLength={5000} aria-describedby={id+"-urls"}/></label><p id={id+"-urls"}>{c.urlsHint}</p>
    {type === "BUG" && (["expected", "observed", "steps"] as const).map(key => <label key={key}>{c[key]}<textarea name={key} maxLength={1000} rows={3} /></label>)}
    {reference && <label className={s.check}><input type="checkbox" name="attach" required={type === "FALSE_POSITIVE"} aria-describedby={id+"-attach"} />{c.attach}</label>}
    {reference && <p id={id+"-attach"}>{c.attachHelp}</p>}
    {antiBot.element}
    <div className={s.trap} aria-hidden="true"><label>{c.website}<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy || type === "FALSE_POSITIVE" && !findingKey}>{busy ? c.sending : c.send}</button>
  </form>;
}
