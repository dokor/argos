"use client";
import { useLang } from "@/lib/i18n/LangContext";
import { findingContent } from "./findingCatalogue";
import { reportReadingCopy } from "./reportReadingCopy";
import type { ReportModel } from "./reportModel";
import type { Report } from "./types";
import s from "./AiSummary.module.scss";

/** Facts shared by all views; free-form AI prose is not a validated source of facts. */
export default function ReportSummary({ report, model }: { report: Report; model: ReportModel }) {
  const { lang } = useLang(); const copy = reportReadingCopy[lang];
  const facts = Object.entries(model.counts).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), copy.summaryFacts as string);
  const partial = report.scores.coverage?.provisional || (typeof report.scores.completeness === "number" && report.scores.completeness < 100) || report.antiBot?.detected;
  return <section className={s.section} aria-labelledby="report-summary">
    <h2 id="report-summary" className={s.title}>{copy.summary}</h2>
    <p className={s.summary}>{facts}</p>
    {report.scores.globalAvailable !== false && report.scores.global >= 65 && model.counts.critical > 0 && <p>{copy.favourableCritical}</p>}
    {partial && <p>{copy.partial}</p>}
    {!report.scores.coverage && <p>{copy.historicalCoverage}</p>}
    {typeof report.scores.completeness === "number" && <p>{copy.moduleCompleteness}: {report.scores.completeness} %</p>}
    <ul className={s.list}>{model.priorities.slice(0, 3).map(({ priority, findings }, index) =>
      <li key={index}>{findings.length === 1 && new Set([priority.findingKey, ...(priority.relatedFindingKeys ?? [])].filter(Boolean)).size === 1
        ? findingContent(findings[0].issue, lang).recommendation : priority.title}</li>)}</ul>
    <p>{copy.next}</p><p className={s.note}>{copy.limits}</p>
  </section>;
}
