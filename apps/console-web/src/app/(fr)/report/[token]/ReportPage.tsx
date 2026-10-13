"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import ReportFeedback, { FeedbackReportContext } from "@/components/feedback/ReportFeedback";
import type { FeedbackReference } from "@/lib/feedback-request";
import { buildReportModel, FindingSelection } from "@/components/report/reportModel";
import ReportHeader from "@/components/report/ReportHeader";
import RunClaim from "@/components/account/RunClaim";
import PublicReportHistory from "@/components/account/PublicReportHistory";
import ReportHero from "@/components/report/ReportHero";
import AccessibilitySection from "@/components/report/AccessibilitySection";
import ReportMethod from "@/components/report/ReportMethod";
import ReportNavigation from "@/components/report/ReportNavigation";
import { useReportReading } from "@/components/report/reportReading";
import { reportReadingCopy } from "@/components/report/reportReadingCopy";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import ReportExport from "@/components/report/ReportExport";
import ReportFooterCta from "@/components/report/ReportFooterCta";
import { Report } from "@/components/report/types";
import { useLang } from "@/lib/i18n/LangContext";
import { useIsAdmin } from "@/lib/useIsAdmin";
import s from "./report.module.scss";
import { interpretationCopy } from "@/components/report/reportInterpretation";
import ReportIntroductionEditor from "@/components/report/ReportIntroductionEditor";

type Params = { params: { report: Report }; feedbackReference?: FeedbackReference };

export default function ReportPage({ params, feedbackReference }: Readonly<Params>) {
  const { report } = params;
  const pathname = usePathname();
  const token = /^\/(?:en\/)?report\/([A-Za-z0-9_-]{20,512})$/.exec(pathname ?? "")?.[1];
  const reference = feedbackReference ?? (token ? { reportToken: token } : undefined);
  useEffect(()=>{window.dispatchEvent(new Event("argos-report-displayed"));},[]);
  const { t, lang } = useLang();
  const tp = t.report.page;
  const isAdmin = useIsAdmin();
  const model = useMemo(() => buildReportModel(report), [report]);
  const reading = useReportReading(model);
  const [methodOpen, setMethodOpen] = useState(false);
  const [noteState, setNoteState] = useState({ report, note: report.introduction });
  const note = noteState.report === report ? noteState.note : report.introduction;
  const showMethod = () => {
    setMethodOpen(true);
    document.getElementById("report-method")?.scrollIntoView({ block: "start", behavior: "smooth" });
    document.getElementById("report-method-toggle")?.focus({ preventScroll: true });
  };
  const selection: FindingSelection | undefined = reading.finding ? { key: reading.finding.key, request: 0 } : undefined;
  const selectFinding = (key: string) => {
    const finding = model.findings.find(item => item.key === key);
    if (finding) reading.navigate({ view: "technical", domain: "all", severity: "all", anchor: finding.anchor });
  };
  const copy = reportReadingCopy[lang];

  return (
    <FeedbackReportContext.Provider value={reference}><div className={s.page} id="top">
      <ReportHeader />
      <ReportHero report={report} model={model} introduction={note} onSelectFinding={selectFinding} onActions={() => reading.navigate({ view: "actions", anchor: "" })} onMethod={showMethod} />

      <main className={s.main}>
        <ReportNavigation view={reading.view} onChange={view => reading.navigate({ view, anchor: "" })} />
        {reading.missing && <p role="status">{copy.missing}</p>}
        {reading.view === "overview" && <section className={s.view} id="report-overview" aria-label={copy.overview}>
          <PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding} limit={3} />
          <ReportFooterCta contained />
          <ScoreGrid categories={report.scores.byCategory} model={model} coverage={report.scores.coverage}
            onSelectDomain={domain => reading.navigate({ view: "technical", domain, severity: "all", anchor: "" })} />
        </section>}
        {reading.view === "actions" && <section className={s.view} id="report-actions" aria-label={copy.actions}>
          <PriorityCards priorities={report.summary.priorities} model={model} onSelectFinding={selectFinding} />
        </section>}
        {reading.view === "technical" && <section className={s.view} id="report-technical" aria-label={copy.technical}>
          <IssuesByCategory report={report} model={model} selection={selection} domain={reading.domain} severity={reading.severity}
            onFilterChange={(domain, severity) => reading.navigate({ domain, severity, anchor: "" })} />
        </section>}
        {reading.view !== "overview" && <ReportFooterCta contained />}
        {(report.accessibilityEvidence || report.accessibilityCompliance) && (reading.view === "technical" ? <AccessibilitySection report={report} /> : <section>
          <h2>{interpretationCopy[lang].accessibility}</h2>
          <p>{t.report.accessibility.limit}</p>
          {report.accessibilityEvidence && <p>{t.report.accessibility.failedLabel} : {report.accessibilityEvidence.failedAudits} · {t.report.accessibility.coverageTitle} : {t.report.accessibility.coverage[report.accessibilityEvidence.coverage]}</p>}
          <details className={s.dataPanel}><summary className={s.dataSummary}>{interpretationCopy[lang].accessibilityDetails}</summary>
          <AccessibilitySection report={report} />
        </details></section>)}
        <ReportMethod report={report} model={model} open={methodOpen} onToggle={setMethodOpen} />
        <details className={s.dataPanel}><summary className={s.dataSummary}>{interpretationCopy[lang].secondary}</summary>
          <ReportExport /><RunClaim /><PublicReportHistory />
        </details>
        <ReportIntroductionEditor key={token} token={token} model={model} onPublished={note => setNoteState({ report, note })} />
        <ReportFeedback />

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

    </div></FeedbackReportContext.Provider>
  );
}
