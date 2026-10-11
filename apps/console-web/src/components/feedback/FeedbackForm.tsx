"use client";
import { useId, useState, type FormEvent } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { accountAuditHeaders } from "@/lib/account-client";
import type { FeedbackReference } from "@/lib/feedback-request";
import { feedbackCopy } from "./copy";
import s from "./FeedbackForm.module.scss";

export default function FeedbackForm({ reference, findingKey }: { reference?: FeedbackReference; findingKey?: string }) {
  const { lang } = useLang(), c = feedbackCopy[lang], id = useId();
  const [type, setType] = useState(findingKey ? "FALSE_POSITIVE" : "SUGGESTION"), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    setBusy(true); setError("");
    const body: Record<string, unknown> = { type, description: values.get("description"), website: values.get("website") };
    if (values.get("page")) body.page = values.get("page");
    if (type === "BUG") for (const key of ["expected", "observed", "steps"]) if (values.get(key)) body[key] = values.get(key);
    if (reference && (findingKey || values.get("attach") === "on")) Object.assign(body, reference);
    if (findingKey) body.findingKey = findingKey;
    try {
      const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", ...await accountAuditHeaders() }, body: JSON.stringify(body), cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.accepted === true) setSent(true);
      else setError(response.status === 429 ? c.limited + (response.headers.get("retry-after") ?? "900") : response.status === 404 ? c.unavailable : response.status === 400 ? c.invalid : c.error);
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }
  if (sent) return <p role="status">{c.received}</p>;
  return <form className={s.form} onSubmit={submit} aria-describedby={id + "-privacy"}>
    <p id={id + "-privacy"}>{c.privacy}</p>
    {findingKey ? <><p>{c.reference}</p><p>{c.finding}: <code>{findingKey}</code></p></> : <label>{c.type}<select value={type} onChange={event => setType(event.target.value)}><option value="SUGGESTION">{c.types.SUGGESTION}</option><option value="BUG">{c.types.BUG}</option></select></label>}
    <label>{c.description}<textarea name="description" required maxLength={4000} rows={5} /></label>
    {!findingKey && <label>{c.page}<select name="page" defaultValue=""><option value="">—</option>{Object.entries(c.pages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
    {type === "BUG" && (["expected", "observed", "steps"] as const).map(key => <label key={key}>{c[key]}<textarea name={key} maxLength={1000} rows={3} /></label>)}
    {reference && !findingKey && <label className={s.check}><input type="checkbox" name="attach" />{c.attach}</label>}
    <div className={s.trap} aria-hidden="true"><label>{c.website}<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? c.sending : c.send}</button>
  </form>;
}
