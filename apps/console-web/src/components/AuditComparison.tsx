"use client";
import { useState } from "react";
import { argosApi, type AuditComparisonDetail, type AuditHistoryItem } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import RelaunchButton from "./report/RelaunchButton";
import s from "./AuditComparison.module.scss";

export default function AuditComparison({ item, auditId, url }: { item: AuditHistoryItem; auditId?: number; url: string }) {
  const { t } = useLang(); const tc=t.auditList.comparison;
  const [detail, setDetail] = useState<AuditComparisonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const evidence = detail ?? (item.comparison ? item : null);
  async function load() {
    if (detail || loading || auditId === undefined) return;
    setLoading(true); setError(false);
    try { setDetail(await argosApi.getComparisonDetail(auditId, item.runId)); }
    catch { setError(true); }
    finally { setLoading(false); }
  }
  if (!evidence) return <details className={s.evidence} onToggle={(event) => {
    if (event.currentTarget.open) void load();
  }}>
    <summary>{tc.show}</summary>
    {loading && <p>{t.auditList.loading}</p>}
    {error && <p>{tc.loadError}</p>}
    {detail && <Evidence detail={detail} url={url}/>}
  </details>;
  return <Evidence detail={evidence} url={url}/>;
}

function Evidence({ detail, url }: { detail: AuditComparisonDetail; url: string }) {
  const { t } = useLang(); const tc=t.auditList.comparison;
  const comparison=detail.comparison;
  const points=(value:number) => `${value>0?"+":""}${Number(value.toFixed(2))}`;
  const domain=(key:string) => (t.report.measurementCoverage.domains as Record<string,string>)[key] ?? key;
  return <div className={s.evidence}>
    <p>{tc.method}: {detail.calculation ? `v${detail.calculation.scoringVersion} · ${detail.calculation.scoringFingerprint ?? tc.unknown}` : tc.unknown}</p>
    <p>{tc.coverage}: {detail.coverage ? `${Math.round(detail.coverage.global.ratio*100)} %${detail.coverage.provisional ? ` — ${t.report.measurementCoverage.provisional}` : ""}` : tc.unknown}</p>
    {comparison?.coverageChanged && <p>{tc.coverageChanged}</p>}
    {comparison?.reason === "COMPARABLE" && typeof comparison.globalDelta === "number" ? <>
      <p>{tc.delta}: {points(comparison.globalDelta)} {tc.points}</p>
      <ul>{comparison.domains.map(change => <li key={change.domain}>{domain(change.domain)}: {points(change.points)} {tc.points}</li>)}</ul>
      {comparison.contributions.length>0 && <details><summary>{tc.contributions}</summary><ul>{comparison.contributions.map(change => <li key={`${change.module}:${change.key}`}>
        {domain(change.domain)} · {change.key}: {points(change.globalPoints)} {tc.globalPoints} ({points(change.domainPoints)} {tc.domainPoints})
      </li>)}</ul></details>}
    </> : <><p>{tc.reasons[comparison?.reason ?? "EVIDENCE_MISSING"]}</p><RelaunchButton url={url}/></>}
  </div>;
}
