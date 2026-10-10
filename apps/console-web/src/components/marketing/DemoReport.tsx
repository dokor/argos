"use client";
import { useState } from "react";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { buildReportModel, type FindingSelection } from "@/components/report/reportModel";
import ReportSummary from "@/components/report/ReportSummary";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import MeasurementCoverage from "@/components/report/MeasurementCoverage";
import { demoReport, DEMO_VERSION } from "./reportDemoFixture";
import s from "./DemoReport.module.scss";

export default function DemoReport() {
  const { lang } = useLang(); const fr = lang === "fr";
  const [partial, setPartial] = useState(false);
  const [selection, setSelection] = useState<FindingSelection>();
  const report = demoReport(lang, partial), model = buildReportModel(report);
  return <section className={s.demo} aria-labelledby="demo-title">
    <h2 id="demo-title">{fr ? "Prévisualisez le rapport Argos" : "Preview the Argos report"}</h2>
    <p className={s.notice}>{fr ? "Exemple illustratif : les scores et la couverture sont synthétiques, sans exécution mesurée. Les trois preuves HTML proviennent de la boutique fictive ci-dessous." : "Illustrative example: scores and coverage are synthetic, with no measured run. The three HTML examples come from the fictional store below."} <small>{DEMO_VERSION}</small></p>
    <fieldset className={s.scenarios}><legend>{fr ? "Scénario illustré" : "Illustrated scenario"}</legend>
      {[false, true].map(value => <label key={String(value)}><input type="radio" name="demo-scenario" checked={partial === value} onChange={() => { setPartial(value); setSelection(undefined); }} />{value ? fr ? "Couverture partielle" : "Partial coverage" : fr ? "Couverture complète" : "Complete coverage"}</label>)}
    </fieldset>
    <div className={s.summary}><ReportSummary report={report} model={model} /><p><strong>{fr ? "Score illustratif" : "Illustrative score"}: {report.scores.global}/100</strong> — {partial ? fr ? "provisoire" : "provisional" : fr ? "scénario complet" : "complete scenario"}</p></div>
    <ScoreGrid categories={report.scores.byCategory} coverage={report.scores.coverage} model={model} />
    <MeasurementCoverage coverage={report.scores.coverage} />
    <PriorityCards priorities={report.summary.priorities} model={model} limit={3} onSelectFinding={key => setSelection({ key, request: (selection?.request ?? 0) + 1 })} />
    <IssuesByCategory report={report} model={model} selection={selection} initialOpenKey="html.meta.description.present" />
    <p><Link href="/methodologie-score">{fr ? "Comprendre la méthode du score" : "Read the scoring method (French)"}</Link> · <Link href="/#audit">{fr ? "Analyser ma page gratuitement" : "Analyse my page for free"}</Link></p>
  </section>;
}

