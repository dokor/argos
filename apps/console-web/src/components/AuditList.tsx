"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AuditListItem, AuditRunStatusResponse, http } from "@/lib/ArgosApi";

type Props = {
  items: AuditListItem[];
  setItems: React.Dispatch<React.SetStateAction<AuditListItem[]>>;
};

function isFinal(status: AuditListItem["status"]) {
  return status === "COMPLETED" || status === "FAILED";
}

export default function AuditList({ items, setItems }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<number | null>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const list = await http<AuditListItem[]>("/api/audits", { method: "GET" });
        if (!mounted) return;

        setItems(list);
      } catch (e: any) {
        console.error(e);
        if (!mounted) return;
        setError(e?.message ?? "Erreur lors du chargement");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setItems]);

  const pendingRuns = useMemo(
    () => items.filter((it) => !isFinal(it.status)).map((it) => it.runId),
    [items]
  );

  // Poll runs that are not final (to update status + json)
  useEffect(() => {
    if (pendingRuns.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const updates = await Promise.all(
          pendingRuns.map((runId) =>
            http<AuditRunStatusResponse>(`/api/audits/runs/${runId}`, { method: "GET" })
              .then((r) => ({ ok: true as const, runId, r }))
              .catch((e) => ({ ok: false as const, runId, e }))
          )
        );

        setItems((prev) => {
          const byRun = new Map(prev.map((x) => [x.runId, x]));
          for (const u of updates) {
            if (!u.ok) continue;
            const existing = byRun.get(u.runId);
            if (!existing) continue;

            byRun.set(u.runId, {
              ...existing,
              status: u.r.status,
              resultJson: u.r.resultJson ?? existing.resultJson ?? null,
              finishedAt: u.r.finishedAt ?? existing.finishedAt ?? null,
            });
          }
          return Array.from(byRun.values());
        });
      } catch (e) {
        console.warn("poll error", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pendingRuns, setItems]);

  async function copyJson(runId: number, json: string) {
    try {
      await navigator.clipboard.writeText(prettyJson(json));
      setCopiedRunId(runId);
      window.setTimeout(() => setCopiedRunId((x) => (x === runId ? null : x)), 1200);
    } catch (e) {
      console.error(e);
      alert("Impossible de copier dans le presse-papier (permission navigateur).");
    }
  }

  if (loading) return <div style={styles.helper}>Chargement…</div>;
  if (error) return <div style={styles.error}>❌ {error}</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={styles.sectionTitle}>Audits</div>

      {items.length === 0 ? (
        <div style={styles.card}>
          <div style={styles.muted}>Aucun audit pour le moment.</div>
        </div>
      ) : (
        items.map((it) => (
          <div key={it.runId} style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div style={styles.url}>{it.normalizedUrl}</div>
                <div style={styles.meta}>auditId={it.auditId} · runId={it.runId}</div>
              </div>

              <StatusBadge status={it.status} />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!it.resultJson ? (
                <div style={styles.muted}>
                  {isFinal(it.status) ? "Pas de JSON disponible." : "En attente du résultat…"}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => copyJson(it.runId, it.resultJson!)}
                    style={styles.button}
                    title="Copier le JSON dans le presse-papier"
                  >
                    {copiedRunId === it.runId ? "✅ Copié" : "📋 Copier le JSON"}
                  </button>
                </>
              )}
            </div>

            {it.resultJson && (
              <details style={{ marginTop: 6 }}>
                <summary style={styles.summary}>Voir le JSON</summary>
                <pre style={styles.pre}>{prettyJson(it.resultJson)}</pre>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function prettyJson(input: string) {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

function StatusBadge({ status }: { status: AuditListItem["status"] }) {
  const label =
    status === "QUEUED" ? "En file"
      : status === "RUNNING" ? "En cours"
        : status === "COMPLETED" ? "Terminé"
          : "Échec";

  const style =
    status === "COMPLETED" ? styles.badgeSuccess
      : status === "FAILED" ? styles.badgeError
        : status === "RUNNING" ? styles.badgeInfo
          : styles.badgeMuted;

  return <div style={style}>{label}</div>;
}

const styles: Record<string, React.CSSProperties> = {
  sectionTitle: {
    fontWeight: 800,
    fontSize: 16,
    color: "#0f172a",
    marginTop: 6,
  },
  helper: {
    padding: 16,
    color: "#0f172a",
  },
  error: {
    padding: 16,
    borderRadius: 12,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#7f1d1d",
    fontWeight: 600,
  },
  card: {
    padding: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
    boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
    display: "grid",
    gap: 10,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  url: {
    fontWeight: 800,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 700,
  },
  meta: {
    fontSize: 12,
    color: "#475569",
  },
  muted: {
    fontSize: 13,
    color: "#475569",
  },
  summary: {
    cursor: "pointer",
    fontWeight: 700,
    color: "#0f172a",
  },
  pre: {
    marginTop: 8,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: 12,
    borderRadius: 12,
    background: "#0b1220", // fond sombre -> lisible
    color: "#e2e8f0",
    border: "1px solid #1f2a44",
    fontSize: 12,
    lineHeight: 1.5,
  },
  button: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  badgeSuccess: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #86efac",
    background: "#dcfce7",
    color: "#14532d",
    fontWeight: 900,
    fontSize: 12,
  },
  badgeError: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#7f1d1d",
    fontWeight: 900,
    fontSize: 12,
  },
  badgeInfo: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #bae6fd",
    background: "#e0f2fe",
    color: "#075985",
    fontWeight: 900,
    fontSize: 12,
  },
  badgeMuted: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#334155",
    fontWeight: 900,
    fontSize: 12,
  },
};
