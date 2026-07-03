"use client";

import React, { useCallback, useRef, useState } from "react";
import Link from "next/link";
import styles from "./AuditCard.module.scss";
import { argosApi, AuditHistoryItem, AuditListItem } from "@/lib/ArgosApi";
import { AuditReportV2, AuditScoreReport, extractTechs, formatPct, prettyJson } from "@/lib/auditTypes";
import { createLogger, safeError } from "@/lib/logger";
import { ScoreChip, ScoreBubbles } from "./ScoreChip";
import StatusBadge from "./StatusBadge";

function isFinal(status: AuditListItem["status"]) {
  return status === "COMPLETED" || status === "FAILED";
}

function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#3b82f6";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

type HistoryTranslations = {
  toggle: string;
  loading: string;
  empty: string;
  error: string;
  current: string;
  view: string;
  scoreNa: string;
};

type Translations = {
  modulesLabel: string;
  tagsLabel: string;
  scorePending: string;
  scoreUnavailable: string;
  viewReport: string;
  reportPending: string;
  noJson: string;
  resultPending: string;
  copyJson: string;
  copied: string;
  showJson: string;
  status: Record<string, string>;
  history: HistoryTranslations;
};

type Props = {
  item: AuditListItem;
  report: AuditReportV2 | null;
  filterModule: string;
  filterTag: string;
  setFilterModule: (v: string) => void;
  setFilterTag: (v: string) => void;
  copiedRunId: number | null;
  onCopyJson: (runId: number, json: string) => void;
  tl: Translations;
};

export default function AuditCard({
  item, report,
  filterModule, filterTag,
  setFilterModule, setFilterTag,
  copiedRunId, onCopyJson,
  tl,
}: Props) {
  const score: AuditScoreReport | undefined = report?.score;
  const techs = extractTechs(report);
  const reportHref = item.reportToken ? "/report/" + item.reportToken : null;

  const th = tl.history;
  const [history, setHistory] = useState<AuditHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const historyLoadedRef = useRef(false);
  const loggerRef = useRef(createLogger("dashboard", { route: "/dashboard" }));

  // Chargement paresseux : l'historique n'est récupéré qu'à la première ouverture.
  const loadHistory = useCallback(async () => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    setHistoryLoading(true);
    setHistoryError(false);
    try {
      const items = await argosApi.getAuditHistory(item.auditId);
      setHistory(items);
    } catch (e) {
      historyLoadedRef.current = false; // autorise un nouvel essai à la prochaine ouverture
      setHistoryError(true);
      loggerRef.current.warn("dashboard_audit_history_load_failed", {
        action: "load_audit_history",
        details: { auditId: item.auditId, error: safeError(e) },
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [item.auditId]);

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.url}>
            {item.hostname ?? item.normalizedUrl}
          </div>
          {item.hostname && (() => {
            const path = item.normalizedUrl.replace(/^https?:\/\/[^/]+/, "") || "/";
            return path !== "/" ? (
              <div className={styles.urlPath}>{path}</div>
            ) : null;
          })()}
          <div className={styles.meta}>
            <span className={styles.metaText}>auditId={item.auditId} runId={item.runId}</span>
            {techs.map((tech) => (
              <span key={tech} className={styles.techBadge}>{tech}</span>
            ))}
          </div>
        </div>

        <div className={styles.headerRight}>
          <StatusBadge status={item.status} labels={tl.status} />

          {score?.global ? (
            <div className={styles.scoreRow}>
              <ScoreBubbles ratio={score.global.ratio} />
              <span className={styles.scoreText}>{formatPct(score.global.ratio)}</span>
            </div>
          ) : (
            <span className={styles.mutedSmall}>
              {isFinal(item.status) ? tl.scoreUnavailable : tl.scorePending}
            </span>
          )}

          {reportHref ? (
            <Link href={reportHref} className={styles.linkBtn}>{tl.viewReport}</Link>
          ) : (
            <span className={styles.linkBtnDisabled}>{tl.reportPending}</span>
          )}
        </div>
      </div>

      {/* Modules */}
      {score?.byModule?.length ? (
        <div className={styles.scoreSection}>
          <div className={styles.sectionLabel}>{tl.modulesLabel}</div>
          <div className={styles.chips}>
            {score.byModule
              .filter((m) => (m.maxScore ?? 0) > 0)
              .slice()
              .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0))
              .map((m) => (
                <ScoreChip
                  key={m.id}
                  label={m.id}
                  ratio={m.ratio}
                  title={m.id + ": " + formatPct(m.ratio)}
                  active={filterModule === m.id}
                  onClick={() => setFilterModule(filterModule === m.id ? "ALL" : m.id)}
                />
              ))}
          </div>
        </div>
      ) : null}

      {/* Tags */}
      {score?.byTag?.length ? (
        <div className={styles.scoreSection}>
          <div className={styles.sectionLabel}>{tl.tagsLabel}</div>
          <div className={styles.chips}>
            {score.byTag
              .filter((tag) => (tag.maxScore ?? 0) > 0)
              .slice()
              .sort((a, b) => (b.maxScore ?? 0) - (a.maxScore ?? 0))
              .map((tag) => (
                <ScoreChip
                  key={tag.id}
                  label={tag.id}
                  ratio={tag.ratio}
                  title={tag.id + ": " + formatPct(tag.ratio)}
                  active={filterTag === tag.id}
                  onClick={() => setFilterTag(filterTag === tag.id ? "ALL" : tag.id)}
                />
              ))}
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className={styles.actions}>
        {!item.resultJson ? (
          <div className={styles.muted}>
            {isFinal(item.status) ? tl.noJson : tl.resultPending}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onCopyJson(item.runId, item.resultJson!)}
              className={styles.copyBtn}
            >
              {copiedRunId === item.runId ? tl.copied : tl.copyJson}
            </button>
            <details>
              <summary className={styles.summary}>{tl.showJson}</summary>
              <pre className={styles.pre}>{prettyJson(item.resultJson!)}</pre>
            </details>
          </>
        )}
      </div>

      {/* Historique des analyses de cette URL (chargé à la demande) */}
      <details
        className={styles.historySection}
        onToggle={(e) => {
          if ((e.currentTarget as HTMLDetailsElement).open) loadHistory();
        }}
      >
        <summary className={styles.summary}>{th.toggle}</summary>

        {historyLoading && <div className={styles.muted}>{th.loading}</div>}
        {historyError && <div className={styles.muted}>{th.error}</div>}
        {!historyLoading && !historyError && history && history.length === 0 && (
          <div className={styles.muted}>{th.empty}</div>
        )}

        {!historyLoading && !historyError && history && history.length > 0 && (
          <ul className={styles.historyList}>
            {history.map((h) => {
              const isCurrent = h.runId === item.runId;
              const href = h.reportToken ? "/report/" + h.reportToken : null;
              return (
                <li key={h.runId} className={styles.historyRow}>
                  <span className={styles.historyDate}>{formatDate(h.createdAt)}</span>
                  <StatusBadge status={h.status} labels={tl.status} />
                  {typeof h.globalScore === "number" ? (
                    <span
                      className={styles.historyScore}
                      style={{ color: scoreColor(h.globalScore) }}
                    >
                      {h.globalScore}/100
                    </span>
                  ) : (
                    <span className={styles.historyScoreNa}>{th.scoreNa}</span>
                  )}
                  {isCurrent && <span className={styles.historyCurrent}>{th.current}</span>}
                  {href && !isCurrent && (
                    <Link href={href} className={styles.historyLink}>{th.view}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </div>
  );
}
