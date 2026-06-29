"use client";

import { CategoryScore } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./ScoreGrid.module.scss";

function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#3b82f6";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
}

function clamp(n: number) { return Math.max(0, Math.min(100, n ?? 0)); }

export default function ScoreGrid({
  categories,
  globalScore,
}: {
  categories: CategoryScore[];
  globalScore: number;
}) {
  const { t } = useLang();
  const ts = t.report.scoreGrid;
  const cats = [...(categories || [])].sort((a, b) => a.score - b.score);
  const global = clamp(globalScore);

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <div className={s.titleBlock}>
          <h2 className={s.sectionTitle}>{ts.title}</h2>
          <p className={s.sectionDesc}>{ts.desc}</p>
        </div>
        <div className={s.globalChip}>
          {ts.globalLabel}
          <span className={s.globalValue} style={{ color: scoreColor(global) }}>
            {global}
          </span>
          /100
        </div>
      </div>

      <div className={s.grid}>
        {cats.map((c) => {
          const sc = clamp(c.score);
          const color = scoreColor(sc);
          return (
            <a key={c.key} href={`#cat-${encodeURIComponent(c.key)}`} className={s.card}>
              <div className={s.cardTop}>
                <div>
                  <p className={s.catLabel}>{c.label}</p>
                  <p className={s.catIssues}>{c.issues} {ts.issueCount}</p>
                </div>
                <span className={s.scoreValue} style={{ color }}>{sc}</span>
              </div>

              <div className={s.track}>
                <div className={s.fill} style={{ width: `${sc}%`, background: color }} />
              </div>

              <span className={s.detailLink}>{ts.seeDetail}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
