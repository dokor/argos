"use client";

import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import ReportFooterCta from "@/components/report/ReportFooterCta";
import { Report } from "@/components/report/types";
import { useLang } from "@/lib/i18n/LangContext";
import s from "./report.module.scss";

type Params = { params: { report: Report } };

export default function ReportPage({ params }: Readonly<Params>) {
  const { report } = params;
  const { t } = useLang();
  const tp = t.report.page;

  return (
    <div className={s.page} id="top">
      <ReportHeader domain={report.domain} />
      <ReportHero report={report} />

      <main className={s.main}>
        <PriorityCards priorities={report.summary.priorities} />
        <ScoreGrid categories={report.scores.byCategory} globalScore={report.scores.global} />
        <IssuesByCategory report={report} />

        {/* Raw JSON — collapsed by default */}
        <details className={s.dataPanel}>
          <summary className={s.dataSummary}>
            {tp.dataTab.title}
            <span className={s.dataChevron} aria-hidden>▾</span>
          </summary>
          <p className={s.dataDesc}>{tp.dataTab.desc}</p>
          <pre className={s.dataPre}>{JSON.stringify(report, null, 2)}</pre>
        </details>
      </main>

      <ReportFooterCta />
    </div>
  );
}
