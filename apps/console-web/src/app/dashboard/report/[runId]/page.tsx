import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { adminReadProxy } from "@/lib/admin-read-proxy";
import ReportPage from "@/app/report/[token]/ReportPage";
import ReportErrorView from "@/components/report/ReportErrorView";

export const dynamic = "force-dynamic";

export default async function AdminReport({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!/^[0-9]+$/.test(runId)) return <ReportErrorView kind="notFound" />;
  const request = new NextRequest(`http://localhost/api/audits/runs/${runId}/report`, {
    headers: { Cookie: (await cookies()).toString() },
  });
  const response = await adminReadProxy(request, `/api/audits/runs/${runId}/report`);
  if (response.status === 401) redirect(`/login?from=${encodeURIComponent(`/dashboard/report/${runId}`)}`);
  if (!response.ok) return <ReportErrorView kind="notFound" />;
  return <ReportPage params={{ report: await response.json() }} />;
}
