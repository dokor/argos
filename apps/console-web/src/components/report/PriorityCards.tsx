"use client";

import { PriorityItem } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { SEVERITY_COLORS } from "./reportColors";
import s from "./PriorityCards.module.scss";

type SevKey = "critical" | "important" | "opportunity";

export default function PriorityCards({ priorities }: { priorities: PriorityItem[] }) {
  const { t, lang } = useLang();
  const tp = t.report.priorityCards;
  const list = (priorities || []).slice(0, 6);

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>{tp.title}</h2>
        <p className={s.sectionDesc}>{tp.desc}</p>
      </div>

      {list.length === 0 ? (
        <p className={s.empty}>{tp.empty}</p>
      ) : (
        <div className={s.grid}>
          {list.map((p, i) => {
            const sev = SEVERITY_COLORS[p.severity as SevKey] ?? SEVERITY_COLORS.opportunity;
            return (
              <div
                key={p.findingKey ?? `${p.title}-${i}`}
                className={s.card}
                style={{ ["--accent" as string]: sev.color }}
              >
                {/* Left accent */}
                <span style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                  background: sev.color, borderRadius: "3px 0 0 3px",
                }} aria-hidden="true" />

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

                <p className={s.cardTitle}>{p.title}</p>
                <p className={s.cardImpact}>{p.impact}</p>
                {p.rankReason && (
                  <div className={s.explanation}>
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
