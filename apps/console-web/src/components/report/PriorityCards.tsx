"use client";

import { CategoryScore, PriorityItem } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { SEVERITY_COLORS } from "./reportColors";
import s from "./PriorityCards.module.scss";

type SevKey = "critical" | "important" | "opportunity";

export default function PriorityCards({ priorities, categories = [] }: { priorities: PriorityItem[]; categories?: CategoryScore[] }) {
  const { t, lang } = useLang();
  const tp = t.report.priorityCards;
  const list = (priorities || []).slice(0, 6);

  return (
    <section className={s.section} id="priorities" aria-labelledby="priorities-title">
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle} id="priorities-title">{tp.title}</h2>
        <p className={s.sectionDesc}>{tp.desc}</p>
      </div>

      {list.length === 0 ? (
        <p className={s.empty}>{tp.empty}</p>
      ) : (
        <ol className={s.grid}>
          {list.map((p, i) => {
            const sev = SEVERITY_COLORS[p.severity as SevKey] ?? SEVERITY_COLORS.opportunity;
            return (
              <li
                key={p.findingKey ?? `${p.title}-${i}`}
                className={s.card}
                style={{ ["--accent" as string]: sev.color }}
              >
                <span className={s.rank} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <div className={s.cardBody}>
                <div className={s.cardTop}>
                  <span
                    className={s.severityBadge}
                    style={{ color: sev.color, background: sev.bg }}
                  >
                    {tp.severity[p.severity as SevKey] ?? p.severity}
                  </span>
                  {p.effort && (
                    <span className={s.effortBadge}>
                      {tp.effortLabel} {p.effort}
                    </span>
                  )}
                </div>

                <h3 className={s.cardTitle}>{p.title}</h3>
                <p className={s.cardImpact}>{p.impact}</p>
                {p.categoryKey && categories.some((category) => category.key === p.categoryKey) && (
                  <a className={s.findingsLink} href={`#cat-${encodeURIComponent(p.categoryKey)}`}>{tp.seeFindings} <span aria-hidden="true">→</span></a>
                )}
                {p.rankReason && (
                  <details className={s.explanation}>
                    <summary>{tp.rankingDetails}</summary>
                    {p.categoryKey && <p>{(tp.domains as Record<string, string>)[p.categoryKey] ?? p.categoryKey}</p>}
                    <p>{tp.rankReasons[p.rankReason]}</p>
                    {p.rankReason === "MODELLED_SCORE_GAIN" && typeof p.globalScoreGain === "number" && Number.isFinite(p.globalScoreGain) && (
                      <p>{tp.gainLabel} {p.globalScoreGain.toLocaleString(lang === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 2 })} {tp.gainUnit}</p>
                    )}
                    {p.confidence && <p>{tp.confidenceLabel} {tp.confidence[p.confidence]}</p>}
                    {p.relatedFindingKeys && p.relatedFindingKeys.length > 1 && (
                      <p>{tp.groupedLabel} {p.relatedFindingKeys.length}</p>
                    )}
                    <p className={s.modelLimit}>{tp.modelLimit}</p>
                  </details>
                )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
