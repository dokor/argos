"use client";

import React, { useMemo, useState } from "react";
import { AuditListItem, CreateAuditResponse } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import { createLogger } from "@/lib/logger";
import { useAuditSubmit } from "@/lib/useAuditSubmit";
import s from "./AuditForm.module.scss";

type Props = {
  onCreated?: (item: AuditListItem) => void;
};

export default function AuditForm({ onCreated }: Props) {
  const { t } = useLang();
  const tf = t.auditForm;
  const logger = useMemo(() => createLogger("dashboard", { route: "/dashboard" }), []);

  const [url, setUrl] = useState("");
  const [emptyError, setEmptyError] = useState<string | null>(null);

  // Création → ouverture du rapport dans un nouvel onglet (#169), factorisée
  // dans useAuditSubmit (#122). L'admin reste sur le dashboard.
  const { phase, error, submit } = useAuditSubmit({
    logger,
    openInNewTab: true,
    onCreated: (res: CreateAuditResponse, normalizedUrl: string) => {
      onCreated?.({
        auditId: Number(res.auditId),
        inputUrl: normalizedUrl,
        normalizedUrl: res.normalizedUrl ?? "",
        runId: Number(res.runId),
        status: res.status,
        reportToken: res.reportToken ?? null,
        resultJson: null,
      });
    },
  });

  const submitting = phase === "submitting" || phase === "redirecting";
  const errorMsg = emptyError ?? (phase === "error" ? error?.message ?? tf.errorUnknown : null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmptyError(null);
    if (!url.trim()) {
      setEmptyError(tf.errorUrlMissing);
      return;
    }
    submit(url);
  }

  return (
    <form onSubmit={handleSubmit} className={s.form}>
      <div className={s.fieldGroup}>
        <label htmlFor="url" className={s.label}>{tf.urlLabel}</label>
        <input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={tf.urlPlaceholder}
          disabled={submitting}
          className={s.input}
        />
      </div>

      <button type="submit" disabled={submitting} className={s.submitBtn}>
        {submitting ? tf.submitting : tf.submit}
      </button>

      {errorMsg && (
        <div className={s.errorMsg}>❌ {errorMsg}</div>
      )}
    </form>
  );
}
