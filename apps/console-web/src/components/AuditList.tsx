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

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Endpoint à prévoir côté backend : GET /api/audits
        const list = await http<AuditListItem[]>("/api/audits", { method: "GET" });

        if (!mounted) return;
        // tri récent -> ancien si createdAt dispo
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
        // On met à jour run par run (simple & robuste MVP)
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

  if (loading) return <div style={{ padding: 16 }}>Chargement…</div>;
  if (error) return <div style={{ padding: 16 }}>❌ {error}</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>Audits</div>

      {items.length === 0 ? (
        <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
          Aucun audit pour le moment.
        </div>
      ) : (
        items.map((it) => (
          <div key={it.runId} style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700 }}>{it.normalizedUrl}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>auditId={it.auditId} · runId={it.runId}</div>
              </div>

              <StatusBadge status={it.status} />
            </div>

            {it.resultJson ? (
              <details>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>JSON résultat</summary>
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 12, borderRadius: 10, background: "#f6f6f6" }}>
                  {prettyJson(it.resultJson)}
                </pre>
              </details>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {isFinal(it.status) ? "Pas de JSON disponible." : "En attente du résultat…"}
              </div>
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
    return input; // si déjà pas du JSON valide / ou string brute
  }
}

function StatusBadge({ status }: { status: AuditListItem["status"] }) {
  const label =
    status === "QUEUED" ? "En file"
      : status === "RUNNING" ? "En cours"
        : status === "COMPLETED" ? "Terminé"
          : "Échec";

  const border =
    status === "COMPLETED" ? "1px solid #2f9e44"
      : status === "FAILED" ? "1px solid #e03131"
        : "1px solid #999";

  const bg =
    status === "COMPLETED" ? "#ebfbee"
      : status === "FAILED" ? "#fff5f5"
        : "#f8f9fa";

  return (
    <div style={{ padding: "6px 10px", borderRadius: 999, border, background: bg, fontWeight: 700, fontSize: 12 }}>
      {label}
    </div>
  );
}
