"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { PUBLIC_CONTACT } from "@/lib/publicContact";
import s from "./ReportAiPrompt.module.scss";

export default function ReportAiPrompt({ kind, id }: { kind: "run" | "report" | "shared"; id: string }) {
  const { t } = useLang();
  const copy = t.report.aiPrompt;
  const [result, setResult] = useState<{ prompt?: string; error?: string }>({});
  const [revision, setRevision] = useState(0);
  const prompt = result.prompt;
  const [status, setStatus] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const preview = useRef<HTMLDetailsElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    queueMicrotask(() => { if (alive) { setResult({}); setStatus("idle"); } });
    void accountFetch<{ prompt: string }>(`report-ai-prompt/${kind}/${id}`, "GET", undefined, controller.signal)
      .then(value => { if (alive) setResult(typeof value.prompt === "string" && value.prompt ? value : { error: "account_unavailable" }); })
      .catch(error => { if (alive) setResult({ error: error instanceof AccountClientError ? error.code : "account_unavailable" }); });
    const invalidate = () => { alive = false; controller.abort(); setResult({ error: "session_invalid" }); };
    window.addEventListener("argos-account-invalid", invalidate);
    return () => { alive = false; controller.abort(); window.removeEventListener("argos-account-invalid", invalidate); };
  }, [kind, id, revision]);

  async function copyPrompt() {
    if (!prompt) return;
    setStatus("busy");
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus("copied");
    } catch {
      if (preview.current) preview.current.open = true;
      field.current?.focus();
      field.current?.select();
      setStatus("error");
    }
  }

  return <section className={s.section} aria-labelledby="report-ai-prompt-title">
    <div className={s.heading}>
      <div className={s.intro}>
        <p className={s.premium}>{copy.premium}</p>
        <h2 id="report-ai-prompt-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      {prompt && <button className={s.copy} type="button" onClick={copyPrompt} disabled={status === "busy"}>
        {copy.copy}
      </button>}
    </div>
    {!prompt && <div className={s.availability}>
      <p role="status">{result.error === "premium_required" ? copy.locked : result.error ? copy.loadFailed : copy.loading}</p>
      {result.error === "premium_required" ? <a className={s.contact} href={PUBLIC_CONTACT.emailHref}>{copy.contact}</a>
        : result.error && <button type="button" className={s.contact} onClick={() => setRevision(value => value + 1)}>{copy.retry}</button>}
    </div>}
    {prompt && <>
    <p className={s.status} role="status">
      {status === "busy" ? copy.copying : status === "copied" ? copy.copied : status === "error" ? copy.failed : ""}
    </p>
    <details ref={preview} className={s.preview}>
      <summary>{copy.preview}</summary>
      <label htmlFor="report-ai-prompt-text" className={s.label}>{copy.label}</label>
      <textarea id="report-ai-prompt-text" ref={field} readOnly value={prompt} rows={12} spellCheck={false} />
    </details>
    </>}
    <p className={s.note}>{copy.note}</p>
  </section>;
}
