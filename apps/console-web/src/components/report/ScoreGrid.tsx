"use client";

import { CategoryScore, Coverage } from "./types";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import type { ReportModel } from "./reportModel";
import s from "./ScoreGrid.module.scss";

import { scoreColor } from "./reportColors";

function clamp(n: number) { return Math.max(0, Math.min(100, n ?? 0)); }

export default function ScoreGrid({
  categories,
  model,
  globalScore,
  globalAvailable,
  completeness,
  coverage,
}: {
  categories: CategoryScore[];
  model?: ReportModel;
  globalScore: number;
  globalAvailable?: boolean | null;
  completeness?: number | null;
  coverage?: Coverage | null;
}) {
  const { t } = useLang();
  const ts = t.report.scoreGrid;
  const catInfo = t.report.categoryInfo as Record<string, string>;
  const domains = t.report.priorityCards.domains as Record<string, string>;
  const cats = model
    ? model.groups.filter(group => group.key !== "unknown" || group.findings.length > 0)
      .map(group => ({ key: group.key, label: domains[group.key] ?? t.report.issuesByCategory.unknownDomain,
        score: group.score?.score, issues: group.findings.length }))
      .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))
    : [...(categories || [])].sort((a, b) => a.score - b.score);
  const global = clamp(globalScore);
  // Analyse partielle : un ou plusieurs modules n'ont pas pu être évalués (issue #101).
  const isPartial = typeof completeness === "number" && completeness < 100;

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <div className={s.titleBlock}>
          <h2 className={s.sectionTitle}>{ts.title}</h2>
          <p className={s.sectionDesc}>{ts.desc}</p>
          <Link href="/methodologie-score" className={s.methodLink}>{ts.methodologyLink}</Link>
          {isPartial && (
            <p className={s.partialNote} title={ts.partialTooltip}>
              ⚠︎ {ts.partial.replace("{n}", String(completeness))}
            </p>
          )}
        </div>
        <div className={`${s.globalChip} ${globalAvailable === false ? s.unavailable : ""}`}>
          {ts.globalLabel}
          {coverage?.provisional && <span>{t.report.measurementCoverage.provisional}</span>}
          {globalAvailable !== false ? (
            <>
              <span className={s.globalValue} style={{ color: scoreColor(global) }}>{global}</span>
              /100
            </>
          ) : <span className={s.globalValue}>{t.report.hero.scoreUnavailable}</span>}
        </div>
      </div>

      <div className={s.grid}>
        {cats.map((c) => {
          const sc = c.score === undefined ? undefined : clamp(c.score);
          const color = sc === undefined ? "var(--argos-text-muted)" : scoreColor(sc);
          return (
            <a key={c.key} href={`#cat-${encodeURIComponent(c.key)}`} className={s.card}>
              <div className={s.cardTop}>
                <div>
                  <p className={s.catLabel}>{(t.report.priorityCards.domains as Record<string, string>)[c.key] ?? c.label}</p>
                  <p className={s.catIssues}>{c.issues} {ts.issueCount}</p>
                </div>
                <span className={`${s.scoreValue} ${sc === undefined ? s.missingScore : ""}`} style={{ color }}>{sc ?? t.report.hero.scoreUnavailable}</span>
              </div>

              <p className={s.catDesc}>{catInfo[c.key] ?? catInfo.fallback}</p>

              {sc !== undefined && <div className={s.track}>
                <div className={s.fill} style={{ width: `${sc}%`, background: color }} />
              </div>}

              <span className={s.detailLink}>{ts.seeDetail}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
