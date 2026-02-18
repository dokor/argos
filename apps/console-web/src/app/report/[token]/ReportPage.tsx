"use client";

import ReportHeader from "@/components/report/ReportHeader";
import ReportHero from "@/components/report/ReportHero";
import ScoreGrid from "@/components/report/ScoreGrid";
import PriorityCards from "@/components/report/PriorityCards";
import IssuesByCategory from "@/components/report/IssuesByCategory";
import ReportFooterCta from "@/components/report/ReportFooterCta";
import { Report } from "@/components/report/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

type Params = {
  params: {
    report: Report;
  };
};

export default function ReportPage({ params }: Readonly<Params>) {
  const { report } = params;

  return (
    <div
      className="theme-light min-h-screen text-slate-900 bg-gradient-to-b from-slate-50 via-white to-slate-50"
      id="top"
    >
      <ReportHeader domain={report.domain} />

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6">
        <ReportHero report={report} />

        <div className="mt-6">
          <Tabs defaultValue="overview" className="w-full">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList className="w-full md:w-auto">
                <TabsTrigger value="overview">Vue d’ensemble</TabsTrigger>
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="data">Données</TabsTrigger>
              </TabsList>

              {/* Petite “hint” premium */}
              <div className="text-sm text-muted-foreground">
                Rapport privé • Non indexable
              </div>
            </div>

            <TabsContent value="overview" className="mt-6">
              <div className="grid gap-6">
                <PriorityCards priorities={report.summary.priorities} />
                <ScoreGrid categories={report.scores.byCategory} globalScore={report.scores.global} />
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-6">
              <IssuesByCategory report={report} />
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <Card className="rounded-2xl shadow-sm bg-white/80 backdrop-blur">
                <CardContent className="p-4 md:p-6">
                  <div className="text-sm font-semibold">JSON du rapport</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Utile pour debug et pour l’export PDF plus tard.
                  </div>

                  <pre
                    className="mt-4 max-h-[520px] overflow-auto rounded-xl border bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ReportFooterCta />
    </div>
  );
}
