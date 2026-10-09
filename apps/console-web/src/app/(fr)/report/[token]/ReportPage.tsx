"use client";

import { useMemo, useState } from "react";
import { buildReportModel, FindingSelection } from "@/components/report/reportModel";
import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import AntiBotNotice from "@/components/report/AntiBotNotice";
import AccessibilitySection from "@/components/report/AccessibilitySection";
import AiSummary from "@/components/report/AiSummary";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import ReportFooterCta from "@/components/report/ReportFooterCta";
import { Report } from "@/components/report/types";
import { useLang } from "@/lib/i18n/LangContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import s from "./report.module.scss";

type Params = { params: { report: Report } };

export default function ReportPage({ params }: Readonly<Params>) {
  const { report } = params;
  const { t } = useLang();
  const tp = t.report.page;
  const isAdmin = useIsAdmin();
  const model = useMemo(() => buildReportModel(report), [report]);
  const [selection, setSelection] = useState<FindingSelection>();
  const selectFinding = (key: string) => setSelection(previous => ({ key, request: (previous?.request ?? 0) + 1 }));

  return (
    <div className={s.page} id="top">
      <ReportHeader />
      <ReportHero report={report} model={model} />

      <main className={s.main}>
        <AntiBotNotice antiBot={report.antiBot} />
        <AiSummary summary={report.summary.ai} />
        <PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding} />
        <ScoreGrid categories={report.scores.byCategory} model={model} globalScore={report.scores.global} globalAvailable={report.scores.globalAvailable} completeness={report.scores.completeness} coverage={report.scores.coverage} />
        <AccessibilitySection report={report} />
        <IssuesByCategory report={report} model={model} selection={selection} />

        {/* Raw JSON - admin only */}
        {isAdmin && (
          <details className={s.dataPanel}>
            <summary className={s.dataSummary}>
              {tp.dataTab.title}
              <span className={s.dataChevron} aria-hidden>▾</span>
            </summary>
            <p className={s.dataDesc}>{tp.dataTab.desc}</p>
            <pre className={s.dataPre}>{JSON.stringify(report, null, 2)}</pre>
          </details>
        )}
      </main>

      <ReportFooterCta />
    </div>
  );
}
