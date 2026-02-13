import { Metadata } from "next";
import { notFound } from "next/navigation";
import { argosApi } from "@/lib/ArgosApi";
import ReportPage from "@/app/report/[token]/ReportPage";
import { Report } from "@/components/report/types";

export const metadata: Metadata = {
  title: "Rapport Argos",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string; }>;
};

export default async function ReportPageHome({ params }: Readonly<Props>) {
  const { token } = await params;
  const report: Report = await argosApi.getReport(token);
  if (!report) notFound();

  return (
    <ReportPage params={{ report }} />
  );
}
