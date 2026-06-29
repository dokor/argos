"use client";

import React, { useState } from "react";
import { argosApi, AuditListItem, CreateAuditRequest, CreateAuditResponse } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";

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
    <form onSubmit={submit} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <label htmlFor="url" style={{ fontWeight: 600, color: "#0f172a" }}>{tf.urlLabel}</label>
        <input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={tf.urlPlaceholder}
          disabled={submitting}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", color: "#0f172a" }}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #111", fontWeight: 600, color: "#0f172a" }}
      >
        {submitting ? tf.submitting : tf.submit}
      </button>

      {successMsg && (
        <div style={{ padding: 10, borderRadius: 10, background: "#eefaf0", border: "1px solid #b7e4c7" }}>
          ✅ {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: 10, borderRadius: 10, background: "#fff0f0", border: "1px solid #f2b8b5" }}>
          ❌ {errorMsg}
        </div>
      )}
    </form>
  );
}
