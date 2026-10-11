"use client";
import { useEffect, useState } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useLang } from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import type { Report } from "@/components/report/types";
import Link from "@/components/LocalizedLink";
export default function PersonalReport({ runId }: { runId: string }) {
  const [report, setReport] = useState<Report | null>(null), [status, setStatus] = useState(""), [error, setError] = useState(""), { t } = useLang();
  useEffect(() => {
    let alive = true;
    const interval = setInterval(() => { void poll(); }, 1500);
    async function poll() {
      try {
        const run = await accountFetch<{ status: string }>("runs/" + runId);
        if (!alive) return;
        setStatus(t.account.statuses[run.status as keyof typeof t.account.statuses] ?? t.account.working);
        if (run.status === "COMPLETED") { const data = await accountFetch<Report>("runs/" + runId + "/report"); if (alive) setReport(data); clearInterval(interval); }
        if (run.status === "FAILED") clearInterval(interval);
      } catch (reason) { if (alive) { const code = reason instanceof AccountClientError ? reason.code : "account_unavailable"; setError(t.account.errors[code as keyof typeof t.account.errors] ?? t.account.errors.account_unavailable); } clearInterval(interval); }
    }
    void poll();
    return () => { alive = false; clearInterval(interval); };
  }, [runId, t]);
  if (report) return <ReportPage params={{ report }} />;
  return <main><h1>{t.account.openReport}</h1><p role={error ? "alert" : "status"}>{error || status || t.account.working}</p><Link href="/account">{t.account.title}</Link></main>;
}
