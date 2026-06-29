"use client";

import React from "react";
import Link from "next/link";
import styles from "./AuditCard.module.scss";
import { AuditListItem } from "@/lib/ArgosApi";
import { AuditReportV2, AuditScoreReport, extractTechs, formatPct, prettyJson } from "@/lib/auditTypes";
import { ScoreChip, ScoreBubbles } from "./ScoreChip";
import StatusBadge from "./StatusBadge";

function isFinal(status: AuditListItem["status"]) {
  return status === "COMPLETED" || status === "FAILED";
}

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
    </div>
  );
}
