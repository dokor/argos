"use client";
import { useLang } from "@/lib/i18n/LangContext";
import { reportReadingCopy } from "./reportReadingCopy";
import { decisionCopy } from "./decisionCopy";
import { globalScore, partialReport } from "./reportSummaryModel";
import type { ReportModel } from "./reportModel";
import type { Report } from "./types";
import s from "./ReportHero.module.scss";

/** The deterministic verdict uses canonical findings, never unvalidated AI prose. */
export default function ReportSummary({ report, model }: { report: Report; model: ReportModel }) {
  const { lang } = useLang();
  const copy = reportReadingCopy[lang];
  const decision = decisionCopy[lang];
  const counts = model.counts;
  const score = globalScore(report);
  const verdict = counts.critical ? "critical" : score === undefined ? "unavailable"
    : counts.important ? "important" : counts.opportunity ? "opportunity" : "empty";
  const facts = Object.entries(counts).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), copy.summaryFacts as string);
  return <div className={s.summary}>
    <h2 className={counts.critical ? s.criticalVerdict : s.verdict}>{decision.verdict[verdict]}</h2>
    <p>{facts}</p>
    {score !== undefined && score >= 70 && counts.critical > 0 && <p>{decision.favourable}</p>}
    {!counts.total && <p>{decision.empty}</p>}
    {partialReport(report) && !report.antiBot?.detected && <p className={s.limit}>{copy.partial}</p>}
    {report.antiBot?.detected && <p className={s.limit}>{decision.antiBot}</p>}
  </div>;
}
