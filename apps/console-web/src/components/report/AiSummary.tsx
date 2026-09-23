"use client";

import { Report } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./AiSummary.module.scss";

type Props = {
  summary?: Report["summary"]["ai"];
};

export default function AiSummary({ summary }: Readonly<Props>) {
  const { lang, t } = useLang();
  const content = summary?.[lang];

  if (!content) return null;

  return (
    <section className={s.section} aria-labelledby="ai-summary-title">
      <div className={s.eyebrow}>{t.report.aiSummary.label}</div>
      <h2 id="ai-summary-title" className={s.title}>{content.headline}</h2>
      <p className={s.summary}>{content.summary}</p>

      {content.keyPoints.length > 0 && (
        <div className={s.points}>
          <h3 className={s.pointsTitle}>{t.report.aiSummary.keyPoints}</h3>
          <ul className={s.list}>
            {content.keyPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      <p className={s.note}>{t.report.aiSummary.note}</p>
    </section>
  );
}
