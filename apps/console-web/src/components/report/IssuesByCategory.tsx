"use client";

import React from "react";
import { Report, Issue, CategoryScore } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./IssuesByCategory.module.scss";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SevKey = "critical" | "important" | "info";

const SEV: Record<SevKey, { dot: string; color: string; bg: string }> = {
  critical:  { dot: "#ef4444", color: "#dc2626", bg: "#fef2f2" },
  important: { dot: "#f59e0b", color: "#d97706", bg: "#fffbeb" },
  info:      { dot: "#94a3b8", color: "#64748b", bg: "#f8fafc" },
};

function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#3b82f6";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
}

function clamp(n: number) { return Math.max(0, Math.min(100, n ?? 0)); }

function groupBy<T extends Record<string, unknown>>(items: T[], key: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = String(it[key] ?? "other");
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return map;
}

function sevWeight(sev: Issue["severity"]) {
  return sev === "critical" ? 0 : sev === "important" ? 1 : 2;
}

type Filter = "all" | SevKey;

// ─── Main component ───────────────────────────────────────────────────────────

export default function IssuesByCategory({ report }: { report: Report }) {
  const { t } = useLang();
  const ti = t.report.issuesByCategory;
  const [filter, setFilter] = React.useState<Filter>("all");

  const categories: CategoryScore[] = report.scores.byCategory || [];
  const allIssues: Issue[] = report.issues || [];
  const filtered = filter === "all" ? allIssues : allIssues.filter((i) => i.severity === filter);
  const byCat = groupBy(filtered, "categoryKey");

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",       label: ti.filterAll },
    { key: "critical",  label: ti.filterCritical },
    { key: "important", label: ti.filterImportant },
    { key: "info",      label: ti.filterInfo },
  ];

  return (
    <section className={s.section}>
      {/* Header */}
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>{ti.title}</h2>
        <p className={s.sectionDesc}>{ti.desc}</p>
      </div>

      {/* Sticky filter bar */}
      <div className={s.filterBar}>
        <span className={s.filterLabel}>{ti.filterAll} :</span>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`${s.filterBtn} ${filter === key ? s.active : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Categories */}
      {categories.map((cat) => {
        const issues = (byCat.get(cat.key) || [])
          .slice()
          .sort((a, b) => sevWeight(a.severity) - sevWeight(b.severity));
        const sc = clamp(cat.score);
        const color = scoreColor(sc);

        return (
          <div key={cat.key} id={`cat-${cat.key}`} className={s.catBlock}>
            <div className={s.catHeader}>
              <div className={s.catMeta}>
                <p className={s.catLabel}>{cat.label}</p>
                <p className={s.catInfo}>
                  {issues.length} {ti.issueCount}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  className={s.catScoreChip}
                  style={{ color, background: `${color}18` }}
                >
                  {sc}{ti.scoreSuffix}
                </span>
                <a href="#top" className={s.backTop}>{ti.backToTop}</a>
              </div>
            </div>

            <div className={s.issueList}>
              {issues.length === 0 ? (
                <p className={s.noIssues}>{ti.noIssues}</p>
              ) : (
                issues.map((issue) => {
                  const sv = SEV[issue.severity as SevKey] ?? SEV.info;
                  return (
                    <details key={issue.id} className={s.issueRow}>
                      <summary className={s.issueSummary}>
                        <span className={s.sevDot} style={{ background: sv.dot }} />

                        <div className={s.issueTags}>
                          <span className={s.sevTag} style={{ color: sv.color, background: sv.bg }}>
                            {ti.severity[issue.severity as SevKey] ?? issue.severity}
                          </span>
                          {issue.effort && (
                            <span className={s.effortTag}>{ti.effortLabel} {issue.effort}</span>
                          )}
                        </div>

                        <span className={s.issueTitle}>{issue.title}</span>
                        <span className={s.issueImpact}>{issue.impact}</span>
                        <span className={s.chevron} aria-hidden>▾</span>
                      </summary>

                      <div className={s.issueDetail}>
                        {issue.impact && (
                          <div className={s.detailBlock}>
                            <p className={s.detailBlockLabel}>Impact</p>
                            <p className={s.detailBlockText}>{issue.impact}</p>
                          </div>
                        )}
                        {issue.evidence && (
                          <div className={s.detailBlock}>
                            <p className={s.detailBlockLabel}>{ti.evidenceLabel}</p>
                            <p className={s.detailBlockText}>{issue.evidence}</p>
                          </div>
                        )}
                        <div className={s.detailBlock}>
                          <p className={s.detailBlockLabel}>{ti.recommendationLabel}</p>
                          <p className={s.detailBlockText}>{issue.recommendation}</p>
                        </div>
                      </div>
                    </details>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
