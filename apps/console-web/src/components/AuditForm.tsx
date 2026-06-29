"use client";

import React, { useState } from "react";
import { argosApi, AuditListItem, CreateAuditRequest, CreateAuditResponse } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AuditForm.module.scss";

type Props = {
  onCreated: (item: AuditListItem) => void;
};

export default function AuditForm({ onCreated }: Props) {
  const { t } = useLang();
  const tf = t.auditForm;

  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMsg(tf.errorUrlMissing);
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateAuditRequest = { url: trimmed };
      const res: CreateAuditResponse = await argosApi.createAudit(payload);

      onCreated({
        auditId: res.auditId,
        inputUrl: trimmed,
        normalizedUrl: res.normalizedUrl,
        runId: res.runId,
        status: res.status,
        resultJson: null,
      });

      setSuccessMsg(`${tf.successPrefix} (runId=${res.runId})`);
      setUrl("");
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : tf.errorUnknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className={s.form}>
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

      {successMsg && (
        <div className={s.successMsg}>✅ {successMsg}</div>
      )}

      {errorMsg && (
        <div className={s.errorMsg}>❌ {errorMsg}</div>
      )}
    </form>
  );
}
