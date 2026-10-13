"use client";
import { useEffect, useState } from "react";
import { accountFetch } from "@/lib/account-client";
import { validIntroduction } from "@/lib/report-introduction";
import { useLang } from "@/lib/i18n/LangContext";
import type { ReportIntroduction } from "./types";
import type { ReportModel } from "./reportModel";
import { findingContent } from "./findingCatalogue";
import { introductionCopy } from "./introductionCopy";
import ReportIntroductionView from "./ReportIntroductionView";
import s from "./ReportIntroduction.module.scss";

type Draft = Omit<ReportIntroduction, "publishedAt">;
const empty: Draft = { author: "", context: "", nextStep: "", findingKeys: [] };
export default function ReportIntroductionEditor({ token, model, onPublished }: { token?: string; model: ReportModel; onPublished: (note: ReportIntroduction | null) => void }) {
  const { lang } = useLang(); const copy = introductionCopy[lang];
  const [owner, setOwner] = useState<string>(); const [draft, setDraft] = useState<Draft>(empty);
  const [published, setPublished] = useState(false); const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState<"saved" | "removed" | "failed" | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true; const controller = new AbortController();
    const clear = () => { alive = false; controller.abort(); setOwner(undefined); setDraft(empty); setPreview(false); };
    window.addEventListener("argos-account-invalid", clear);
    async function load() {
      try {
        const result = await accountFetch<{ introduction: ReportIntroduction | null }>("report-introduction/" + token, "GET", undefined, controller.signal);
        if (alive) { setOwner(token); setDraft(result.introduction ? { author: result.introduction.author, context: result.introduction.context, findingKeys: result.introduction.findingKeys, nextStep: result.introduction.nextStep } : empty); setPublished(!!result.introduction); }
      } catch { /* A shared capability does not grant owner editing. */ }
    }
    void load();
    return () => { alive = false; controller.abort(); window.removeEventListener("argos-account-invalid", clear); };
  }, [token]);
  if (!token || owner !== token) return null;
  const eligible = model.findings.filter(f => f.issue.id);
  async function save(revoke = false) {
    setBusy(true); setStatus(null);
    try {
      const result = await accountFetch<{ introduction: ReportIntroduction | null }>("report-introduction/" + token, revoke ? "DELETE" : "PUT", revoke ? undefined : draft);
      onPublished(result.introduction); setPublished(!!result.introduction); setStatus(revoke ? "removed" : "saved"); setPreview(false);
    } catch { setStatus("failed"); } finally { setBusy(false); }
  }
  return <details className={s.editor}><summary>{copy.edit}</summary><p>{copy.scope}</p>
    {eligible.length < 2 ? <p>{copy.empty}</p> : <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor="introduction-author">{copy.author}</label><input id="introduction-author" required maxLength={120} value={draft.author} onChange={e => setDraft({ ...draft, author: e.target.value })} />
      <label htmlFor="introduction-context">{copy.context}</label><textarea id="introduction-context" required maxLength={1200} value={draft.context} onChange={e => setDraft({ ...draft, context: e.target.value })} />
      <fieldset><legend>{copy.findings}</legend>{eligible.map(f => <label className={s.choice} key={f.key}><input type="checkbox" checked={draft.findingKeys.includes(f.key)} disabled={busy || draft.findingKeys.length >= 3 && !draft.findingKeys.includes(f.key)} onChange={e => setDraft({ ...draft, findingKeys: e.target.checked ? [...draft.findingKeys, f.key] : draft.findingKeys.filter(key => key !== f.key) })} />{findingContent(f.issue, lang).title}</label>)}</fieldset>
      <label htmlFor="introduction-next">{copy.next}</label><textarea id="introduction-next" required maxLength={500} value={draft.nextStep} onChange={e => setDraft({ ...draft, nextStep: e.target.value })} />
      <div className={s.actions}><button type="button" disabled={busy || !validIntroduction(draft)} onClick={() => setPreview(!preview)} aria-pressed={preview}>{copy.preview}</button>
        <button type="submit" disabled={busy || !validIntroduction(draft)}>{busy ? copy.busy : copy.publish}</button></div>
      {preview && <ReportIntroductionView note={{ ...draft, publishedAt: "" }} model={model} lang={lang} />}
    </form>}
    {published && <button type="button" disabled={busy} onClick={() => void save(true)}>{copy.revoke}</button>}
    <p role="status">{status ? copy[status] : ""}</p>
  </details>;
}
