"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { argosApi, CreateAuditResponse, RunStatusResponse } from "@/lib/ArgosApi";

function isValidUrlLike(input: string): boolean {
  const v = input.trim();
  if (!v) return false;
  // accepte "example.com" ou "https://example.com"
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v) || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(v);
}

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createResp, setCreateResp] = useState<CreateAuditResponse | undefined>(undefined);
  const [runStatus, setRunStatus] = useState<RunStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => isValidUrlLike(url) && !submitting, [url, submitting]);

  const pollTimer = useRef<number | null>(null);

  async function submit() {
    setError(null);
    setCreateResp(undefined);
    setRunStatus(null);

    setSubmitting(true);
    try {
      const resp = await argosApi.createAudit({ url });
      setCreateResp(resp);

      // première lecture statut
      const status = await argosApi.getRunStatus(resp.runId);
      setRunStatus(status);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  }

  // polling tant que QUEUED/RUNNING
  useEffect(() => {
    if (!createResp?.runId) return;

    async function tick() {
      if (!createResp) return; // vérifier
      try {
        const s = await argosApi.getRunStatus(createResp.runId);
        setRunStatus(s);

        if (s.status === "COMPLETED" || s.status === "FAILED") {
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
        }
      } catch (e: any) {
        // on n’arrête pas forcément, mais on affiche
        setError(e?.message ?? "Erreur polling");
      }
    }

    // start
    pollTimer.current = window.setInterval(tick, 1500);
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [createResp?.runId]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span>URL à auditer</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
      </label>

      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {submitting ? "Envoi..." : "Lancer l’audit"}
      </button>

      {!isValidUrlLike(url) && url.trim().length > 0 && (
        <p style={{ color: "crimson" }}>URL invalide (ex: example.com ou https://example.com)</p>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {createResp && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          <div><b>Audit</b> #{createResp.auditId}</div>
          <div><b>Run</b> #{createResp.runId}</div>
          <div><b>Créé</b> : {createResp.status}</div>
        </div>
      )}

      {runStatus && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          <div><b>Statut</b> : {runStatus.status}</div>
          {runStatus.startedAt && <div>Start : {runStatus.startedAt}</div>}
          {runStatus.finishedAt && <div>End : {runStatus.finishedAt}</div>}
          {runStatus.lastError && (
            <pre style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: 10, borderRadius: 8 }}>
              {runStatus.lastError}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
