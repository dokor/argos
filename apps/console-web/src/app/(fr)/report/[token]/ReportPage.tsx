"use client";

import { useMemo } from "react";
import { buildReportModel, FindingSelection } from "@/components/report/reportModel";
import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import AntiBotNotice from "@/components/report/AntiBotNotice";
import AccessibilitySection from "@/components/report/AccessibilitySection";
import ReportSummary from "@/components/report/ReportSummary";
import ReportNavigation from "@/components/report/ReportNavigation";
import { useReportReading } from "@/components/report/reportReading";
import { reportReadingCopy } from "@/components/report/reportReadingCopy";
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
  const { t, lang } = useLang();
  const tp = t.report.page;
  const isAdmin = useIsAdmin();
  const model = useMemo(() => buildReportModel(report), [report]);
  const reading = useReportReading(model);
  const selection: FindingSelection | undefined = reading.finding ? { key: reading.finding.key, request: 0 } : undefined;
  const selectFinding = (key: string) => {
    const finding = model.findings.find(item => item.key === key);
    if (finding) reading.navigate({ view: "technical", domain: "all", severity: "all", anchor: finding.anchor });
  };
  const copy = reportReadingCopy[lang];

  return (
    <div className={s.page} id="top">
      <ReportHeader />
      <ReportHero report={report} model={model} />

      <main className={s.main}>
        <AntiBotNotice antiBot={report.antiBot} />
        <ReportSummary report={report} model={model} />
        <ReportNavigation view={reading.view} onChange={view => reading.navigate({ view, anchor: "" })} />
        {reading.missing && <p role="status">{copy.missing}</p>}
        {reading.view === "overview" && <section className={s.view} id="report-overview" aria-label={copy.overview}>
          <ScoreGrid categories={report.scores.byCategory} model={model} globalScore={report.scores.global} globalAvailable={report.scores.globalAvailable} completeness={report.scores.completeness} coverage={report.scores.coverage}
            onSelectDomain={domain => reading.navigate({ view: "technical", domain, severity: "all", anchor: "" })} />
          <PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding} limit={3} />
        </section>}
        {reading.view === "actions" && <section className={s.view} id="report-actions" aria-label={copy.actions}>
          <PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding} />
        </section>}
        {reading.view === "technical" && <section className={s.view} id="report-technical" aria-label={copy.technical}>
          <IssuesByCategory report={report} model={model} selection={selection} domain={reading.domain} severity={reading.severity}
            onFilterChange={(domain, severity) => reading.navigate({ domain, severity, anchor: "" })} />
        </section>}
        <AccessibilitySection report={report} />

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
