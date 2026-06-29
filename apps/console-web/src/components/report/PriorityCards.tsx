"use client";

import { PriorityItem } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./PriorityCards.module.scss";

type SevKey = "critical" | "important" | "opportunity";

const SEV: Record<SevKey, { color: string; bg: string; label?: string }> = {
  critical:    { color: "#dc2626", bg: "#fef2f2" },
  important:   { color: "#d97706", bg: "#fffbeb" },
  opportunity: { color: "#059669", bg: "#f0fdf4" },
};

export default function PriorityCards({ priorities }: { priorities: PriorityItem[] }) {
  const { t } = useLang();
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
            const sev = SEV[p.severity as SevKey] ?? SEV.opportunity;
            return (
              <div
                key={`${p.title}-${i}`}
                className={s.card}
                style={{ ["--accent" as string]: sev.color }}
              >
                {/* Left accent */}
                <span style={{
                  position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
                  background: sev.color, borderRadius: "3px 0 0 3px",
                }} />

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
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
