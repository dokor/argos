"use client";

import React, { useEffect, useMemo, useState } from "react";
import { argosApi, AuditListItem } from "@/lib/ArgosApi";
import Link from "next/link";

type Props = {
  items: AuditListItem[];
  setItems: React.Dispatch<React.SetStateAction<AuditListItem[]>>;
};

function isFinal(status: AuditListItem["status"]) {
  return status === "COMPLETED" || status === "FAILED";
}

type ScoreAggregate = {
  id: string;
  score: number;
  maxScore: number;
  ratio: number; // 0..1
};

type AuditScoreReport = {
  scoringVersion: number;
  global: ScoreAggregate;
  byModule: ScoreAggregate[];
  byTag: ScoreAggregate[];
};

type AuditReportV2 = {
  schemaVersion: number;
  score?: AuditScoreReport;
};

export default function AuditList({ items, setItems }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedRunId, setCopiedRunId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const list: AuditListItem[] = await argosApi.getList();
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

  useEffect(() => {
    if (pendingRuns.length === 0) return;

    const interval = setInterval(async () => {
      try {

        const updates = await Promise.all(
          pendingRuns.map((runId) =>
            argosApi.getRunsByRunId(runId)
              // @ts-ignore
              .then((r) => ({ ok: true as const, runId, r }))
              // @ts-ignore
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
              reportToken: u.r.reportToken ?? existing.reportToken ?? null,
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
        items.map((it) => {
          const report: AuditReportV2 | null = parseReport(it.resultJson);
          const score: AuditScoreReport | undefined = report?.score;
          const reportHref: string | null = it.reportToken ? `/report/${it.reportToken}` : null;
          return (
            <div key={it.runId} style={styles.card}>
              <div style={styles.cardHeader}>
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <div style={styles.url}>{it.normalizedUrl}</div>
                  <div style={styles.meta}>auditId={it.auditId} · runId={it.runId}</div>
                </div>

                <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                  <StatusBadge status={it.status} />
                  {reportHref ? (
                    <Link href={reportHref} style={styles.linkButton}>
                      🔎 Voir le rapport
                    </Link>
                  ) : (
                    <span style={styles.linkButtonDisabled}>Rapport en attente…</span>
                  )}
                  {score?.global ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ScoreBubbles ratio={score.global.ratio} />
                      <div style={styles.scoreText}>
                        {formatPct(score.global.ratio)} ({round1(score.global.score)}/{round1(score.global.maxScore)})
                      </div>
                    </div>
                  ) : (
                    <div style={styles.mutedSmall}>
                      {isFinal(it.status) ? "Score indisponible" : "Score en attente…"}
                    </div>
                  )}
                </div>
              </div>

              {/* Modules */}
              {score?.byModule?.length ? (
                <div style={styles.row}>
                  <div style={styles.rowLabel}>Modules</div>
                  <div style={styles.chips}>
                    {score.byModule
                      .slice()
                      .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
                      .map((m) => (
                        <ScoreChip
                          key={`m-${m.id}`}
                          label={m.id}
                          ratio={m.ratio}
                          title={`${m.id}: ${formatPct(m.ratio)} (${round1(m.score)}/${round1(m.maxScore)})`}
                        />
                      ))}
                  </div>
                </div>
              ) : null}

              {/* Tags */}
              {score?.byTag?.length ? (
                <div style={styles.row}>
                  <div style={styles.rowLabel}>Tags</div>
                  <div style={styles.chips}>
                    {score.byTag
                      .slice()
                      .sort((a, b) => (b.maxScore ?? 0) - (a.maxScore ?? 0)) // plus "impactant" d'abord
                      .map((t) => (
                        <ScoreChip
                          key={`t-${t.id}`}
                          label={t.id}
                          ratio={t.ratio}
                          title={`${t.id}: ${formatPct(t.ratio)} (${round1(t.score)}/${round1(t.maxScore)})`}
                        />
                      ))}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {!it.resultJson ? (
                  <div style={styles.muted}>
                    {isFinal(it.status) ? "Pas de JSON disponible." : "En attente du résultat…"}
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => copyJson(it.runId, it.resultJson!)} style={styles.button}>
                      {copiedRunId === it.runId ? "✅ Copié" : "📋 Copier le JSON"}
                    </button>

                    <details>
                      <summary style={styles.summary}>Voir le JSON</summary>
                      <pre style={styles.pre}>{prettyJson(it.resultJson!)}</pre>
                    </details>
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function parseReport(resultJson: string | null | undefined): AuditReportV2 | null {
  if (!resultJson) return null;
  try {
    const parsed = JSON.parse(resultJson) as AuditReportV2;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function prettyJson(input: string) {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

function formatPct(ratio: number) {
  const pct = Math.round((ratio ?? 0) * 100);
  return `${pct}%`;
}

function round1(v: number) {
  return Math.round((v ?? 0) * 10) / 10;
}

/**
 * Affiche un score sous forme de bulles : 0..5
 * - 0% => ○○○○○
 * - 100% => ●●●●●
 */
function ScoreBubbles({ ratio }: { ratio: number }) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  const filled = Math.round(r * 5); // 0..5
  const dots = Array.from({ length: 5 }, (_, i) => i < filled);

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {dots.map((on, idx) => (
        <span
          key={idx}
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            display: "inline-block",
            background: on ? "#0f172a" : "#cbd5e1",
          }}
        />
      ))}
    </div>
  );
}

function ScoreChip({ label, ratio, title }: { label: string; ratio: number; title?: string }) {
  const r = Math.max(0, Math.min(1, ratio ?? 0));
  const bg = r >= 0.8 ? "#dcfce7" : r >= 0.6 ? "#e0f2fe" : r >= 0.4 ? "#fef9c3" : "#fee2e2";
  const fg = r >= 0.8 ? "#14532d" : r >= 0.6 ? "#075985" : r >= 0.4 ? "#713f12" : "#7f1d1d";
  const border = r >= 0.8 ? "#86efac" : r >= 0.6 ? "#bae6fd" : r >= 0.4 ? "#fde68a" : "#fecaca";

  return (
    <div
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color: fg,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      <span>{label}</span>
      <span style={{ fontWeight: 900, opacity: 0.9 }}>{formatPct(r)}</span>
    </div>
  );
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
  sectionTitle: { fontWeight: 800, fontSize: 16, color: "#0f172a", marginTop: 6 },
  helper: { padding: 16, color: "#0f172a" },
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
    gap: 12,
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" },
  url: {
    fontWeight: 900,
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 700,
  },
  meta: { fontSize: 12, color: "#475569" },
  muted: { fontSize: 13, color: "#475569" },
  mutedSmall: { fontSize: 12, color: "#64748b" },
  scoreText: { fontSize: 12, color: "#0f172a", fontWeight: 800 },
  row: { display: "grid", gap: 8 },
  rowLabel: { fontSize: 12, fontWeight: 900, color: "#0f172a" },
  chips: { display: "flex", gap: 8, flexWrap: "wrap" },
  summary: { cursor: "pointer", fontWeight: 800, color: "#0f172a" },
  pre: {
    marginTop: 8,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: 12,
    borderRadius: 12,
    background: "#0b1220",
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
    fontWeight: 900,
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
