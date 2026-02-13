import { Metadata } from "next";
import { notFound } from "next/navigation";
import { argosApi } from "@/lib/ArgosApi";
import ReportPage from "@/app/report/[token]/ReportPage";
import { Report } from "@/components/report/types";

export const metadata: Metadata = {
  title: "Rapport Argos",
  robots: { index: false, follow: false },
};

export default async function ReportPageHome({ params }: { params: { token: string } }) {
  const report: Report = await argosApi.getReport(params.token ?? 'BYkE3pWUbWL1ADUB5Y7Qlc3KTeA9GBjb_OD8bncpO38');
  if (!report) notFound();

  return (
    <ReportPage params={{ report }} />
  );
}
