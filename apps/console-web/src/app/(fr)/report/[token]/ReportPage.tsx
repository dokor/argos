"use client";

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

  return (
    <div className={s.page} id="top">
      <ReportHeader />
      <ReportHero report={report} />

      <nav className={s.contents} aria-label={tp.navigation.label}>
        <div className={s.contentsInner}>
          <a href="#priorities">{tp.navigation.priorities}</a>
          <a href="#scores">{tp.navigation.scores}</a>
          <a href="#findings">{tp.navigation.findings} <span>{report.issues?.length ?? 0}</span></a>
        </div>
      </nav>
      <main className={s.main}>
        <AntiBotNotice antiBot={report.antiBot} />
        <AiSummary summary={report.summary.ai} />
        <PriorityCards priorities={report.summary.priorities} categories={report.scores.byCategory} />
        <ScoreGrid categories={report.scores.byCategory} globalScore={report.scores.global} globalAvailable={report.scores.globalAvailable} completeness={report.scores.completeness} coverage={report.scores.coverage} />
        <AccessibilitySection report={report} />
        <IssuesByCategory report={report} />

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
