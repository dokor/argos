"use client";

import { useAntiBot } from "@/components/security/useAntiBot";
import React, { useMemo, useState, useRef } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger } from "@/lib/logger";
import { useAuditSubmit } from "@/lib/useAuditSubmit";
import { normalizeInputUrl } from "@/lib/url";
import s from "./AuditForm.module.scss";

type Props = {
  mode?: "public";
  sourceRoute?: string;
  idPrefix?: string;
  submitLabel?: string;
  initialUrl?: string;
};

function isValidPublicUrl(raw: string): boolean {
  const normalized = normalizeInputUrl(raw);
  if (normalized.length > 2048) return false;
  try {
    const parsed = new URL(normalized);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export default function AuditForm({ sourceRoute, idPrefix, submitLabel, initialUrl = "" }: Props) {
  const { t } = useLang();
  const tf = t.marketing.form;
  const logger = useMemo(
    () => createLogger("landing", { route: sourceRoute ?? "/" }),
    [sourceRoute]
  );

  const antiBot=useAntiBot("audit");
  const [verifying,setVerifying]=useState(false);
  const verifyLock=useRef(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [inputError, setInputError] = useState<string | null>(null);

  const { phase, error, submit } = useAuditSubmit({
    logger,
    sourceRoute,
  });

  const submitting = verifying || phase === "submitting" || phase === "polling" || phase === "redirecting";
  const errorMsg = inputError ?? (phase === "error"
    ? error && "code" in error && error.code === "antibot_invalid" ? t.account.errors.antibot_invalid : error && "code" in error && error.code === "antibot_unavailable" ? t.account.errors.antibot_unavailable : error && "code" in error && error.code === "quota_exceeded" ? t.account.usage.reached : t.marketing.form.errorRequest
    : null);
  const inputId = idPrefix ? `${idPrefix}-audit-url` : "public-audit-url";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if(verifyLock.current || submitting) return;
    setInputError(null);
    if (!url.trim()) {
      setInputError(tf.errorUrlMissing);inputRef.current?.focus();
      return;
    }
    if (!isValidPublicUrl(url)) {
      setInputError(t.marketing.form.errorInvalidUrl);inputRef.current?.focus();
      return;
    }
    verifyLock.current=true;setVerifying(true);
    try { await submit(url,await antiBot.verify()); } catch { /* The verification component explains retry and support. */ }
    finally {verifyLock.current=false;setVerifying(false);}
  }

  return (
    <form method="post" onSubmit={handleSubmit} className={`${s.form} ${s.publicForm}`} noValidate>
      <div className={s.fieldGroup}>
        <label htmlFor={inputId} className={s.label}>{tf.urlLabel}</label>
        <input
          ref={inputRef}
          maxLength={2048}
          id={inputId}
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={url}
          onChange={(e) => { setUrl(e.target.value); setInputError(null); }}
          placeholder={tf.urlPlaceholder}
          disabled={submitting}
          aria-invalid={Boolean(errorMsg)}
          aria-describedby={errorMsg ? `${inputId}-error` : undefined}
          className={s.input}
        />
      </div>

      {antiBot.element}
      <button type="submit" disabled={submitting} className={s.submitBtn}>
        {submitting ? tf.submitting : submitLabel ?? tf.submit}
      </button>

      {submitting && (
        <p role="status" className={s.statusMsg}>
          {phase === "submitting" ? t.marketing.form.submitting : t.marketing.form.analysing}
        </p>
      )}
      {errorMsg && (
        <div id={`${inputId}-error`} role="alert" className={s.errorMsg}>{errorMsg}</div>
      )}
      <p className={s.hint}>{t.marketing.form.hint}</p>
    </form>
  );
}
