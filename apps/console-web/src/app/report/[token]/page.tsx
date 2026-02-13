import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Report } from "@/components/report/types";
import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import ReportFooterCta from "@/components/report/ReportFooterCta";
import { http } from "@/lib/ArgosApi";

export const metadata: Metadata = {
  title: "Rapport Argos",
  robots: { index: false, follow: false },
};

async function fetchReport(token: string): Promise<Report | null> {
  return await http<Report>(`/reports/${token}`, { method: "GET" });
}

export default async function ReportPage({ params }: Readonly<{ params: { token: string } }>) {
  // const sp = useSearchParams();
  console.log("ReportPage params", { params });
  // console.log("ReportPage sp", { sp });
  const report: Report | null = await fetchReport(params.token);
  if (!report) notFound();

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
