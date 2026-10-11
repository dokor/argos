"use client";

import React, { useMemo, useState, useRef } from "react";
import { AuditListItem, CreateAuditResponse } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger } from "@/lib/logger";
import { useAuditSubmit } from "@/lib/useAuditSubmit";
import { normalizeInputUrl } from "@/lib/url";
import s from "./AuditForm.module.scss";

type Props = {
  onCreated?: (item: AuditListItem) => void;
  mode?: "dashboard" | "public" | "personal";
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

export default function AuditForm({ onCreated, mode = "dashboard", sourceRoute, idPrefix, submitLabel, initialUrl = "" }: Props) {
  const { t } = useLang();
  const publicMode = mode === "public";
  const tf = publicMode ? t.marketing.form : t.auditForm;
  const logger = useMemo(
    () => createLogger(publicMode ? "landing" : "dashboard", { route: sourceRoute ?? "/dashboard" }),
    [publicMode, sourceRoute]
  );

  const inputRef=useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [inputError, setInputError] = useState<string | null>(null);

  // Le dashboard ouvre le rapport dans un nouvel onglet (#169) ; les pages
  // publiques le montrent dans l'onglet courant. Le hook garde le même BFF.
  const { phase, error, submit } = useAuditSubmit({
    logger,
    sourceRoute,
    openInNewTab: mode === "dashboard",
    personal: mode === "personal",
    onCreated: (res: CreateAuditResponse, normalizedUrl: string) => {
      onCreated?.({
        auditId: Number(res.auditId),
        inputUrl: normalizedUrl,
        normalizedUrl: res.normalizedUrl ?? "",
        runId: Number(res.runId),
        status: res.status,
        reportUrl: null,
        resultJson: null,
      });
    },
  });

  const submitting = phase === "submitting" || phase === "polling" || phase === "redirecting";
  const errorMsg = inputError ?? (phase === "error"
    ? publicMode || mode === "personal" ? t.marketing.form.errorRequest : error?.message ?? t.auditForm.errorUnknown
    : null);
  const inputId = idPrefix ? `${idPrefix}-audit-url` : publicMode ? "public-audit-url" : "url";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInputError(null);
    if (!url.trim()) {
      setInputError(tf.errorUrlMissing);inputRef.current?.focus();
      return;
    }
    if ((publicMode || mode === "personal") && !isValidPublicUrl(url)) {
      setInputError(t.marketing.form.errorInvalidUrl);inputRef.current?.focus();
      return;
    }
    submit(url);
  }

  return (
    <form onSubmit={handleSubmit} className={`${s.form} ${publicMode ? s.publicForm : ""}`} noValidate>
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

      <button type="submit" disabled={submitting} className={s.submitBtn}>
        {submitting ? tf.submitting : submitLabel ?? tf.submit}
      </button>

      {publicMode && submitting && (
        <p role="status" className={s.statusMsg}>
          {phase === "submitting" ? t.marketing.form.submitting : t.marketing.form.analysing}
        </p>
      )}
      {errorMsg && (
        <div id={`${inputId}-error`} role="alert" className={s.errorMsg}>{errorMsg}</div>
      )}
      {publicMode && <p className={s.hint}>{t.marketing.form.hint}</p>}
    </form>
  );
}
