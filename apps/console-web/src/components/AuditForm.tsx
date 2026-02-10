"use client";

import React, { useState } from "react";
import { AuditListItem, CreateAuditRequest, CreateAuditResponse, http } from "@/lib/ArgosApi";

type Props = {
  onCreated: (item: AuditListItem) => void;
};

export default function AuditForm({ onCreated }: Props) {
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
      setErrorMsg("URL manquante");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateAuditRequest = { url: trimmed };
      const res = await http<CreateAuditResponse>("/api/audits", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // On pousse immédiatement un item en liste (optimistic)
      onCreated({
        auditId: res.auditId,
        inputUrl: trimmed,
        normalizedUrl: res.normalizedUrl,
        runId: res.runId,
        status: res.status,
        resultJson: null,
      });

      setSuccessMsg(`Audit créé (runId=${res.runId})`);
      setUrl("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <label htmlFor="url" style={{ fontWeight: 600, color: "#0f172a" }}>URL à analyser</label>
        <input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          disabled={submitting}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", color: "#0f172a" }}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        style={{ padding: 10, borderRadius: 10, border: "1px solid #111", fontWeight: 600, color: "#0f172a" }}
      >
        {submitting ? "Envoi..." : "Lancer l'audit"}
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
