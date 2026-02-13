import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Report } from "@/components/report/types";
import { argosApi } from "@/lib/ArgosApi";
import ReportPage from "@/app/report/[token]/ReportPage";

export const metadata: Metadata = {
  title: "Rapport Argos",
  robots: { index: false, follow: false },
};

export default async function ReportPageHome() {
  const report: Report | null = await argosApi.getReport("nIjDfQeMR9tcQuC_R7MsjhZ6blKezECXfLI5erUKOMM");
  if (!report) notFound();

  return (
    <ReportPage report={report} />
  );
}
