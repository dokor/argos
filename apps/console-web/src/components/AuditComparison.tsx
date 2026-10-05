"use client";
import type { AuditHistoryItem } from "@/lib/ArgosApi";
import { useLang } from "@/lib/i18n/LangContext";
import RelaunchButton from "./report/RelaunchButton";
import s from "./AuditComparison.module.scss";

export default function AuditComparison({ item, url }: { item: AuditHistoryItem; url: string }) {
  const { t } = useLang(); const tc=t.auditList.comparison;
  const comparison=item.comparison;
  const points=(value:number) => `${value>0?"+":""}${Number(value.toFixed(2))}`;
  const domain=(key:string) => (t.report.measurementCoverage.domains as Record<string,string>)[key] ?? key;
  return <div className={s.evidence}>
    <p>{tc.method}: {item.calculation ? `v${item.calculation.scoringVersion} · ${item.calculation.scoringFingerprint ?? tc.unknown}` : tc.unknown}</p>
    <p>{tc.coverage}: {item.coverage ? `${Math.round(item.coverage.global.ratio*100)} %${item.coverage.provisional ? ` — ${t.report.measurementCoverage.provisional}` : ""}` : tc.unknown}</p>
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
