"use client"

import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import ReportFooterCta from "@/components/report/ReportFooterCta";
import { Report } from "@/components/report/types";

type Params = {
  params: {
    report: Report;
  }
}

export default async function ReportPage({ params }: Readonly<Params>) {
  const { report } = params;
  return (
    <div className="min-h-screen bg-background text-foreground" id={'top'}>
      <ReportHeader domain={report.domain} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
        <ReportHero report={report} />
        <div className="mt-6 grid gap-6">
          <PriorityCards priorities={report.summary.priorities} />
          <ScoreGrid categories={report.scores.byCategory} globalScore={report.scores.global} />
          <IssuesByCategory report={report} />
        </div>
        <ReportFooterCta />
      </main>
    </div>
  );
}
