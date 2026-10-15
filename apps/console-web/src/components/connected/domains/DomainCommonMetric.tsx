"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { BatchSummary } from "@/lib/connected/contracts";
import { useDomainResource, activeStatus } from "./useDomainResource";
import { clarteCopy } from "../clarteCopy";
import s from "./Domains.module.scss";
/** Keep the lightweight list read: fetch canonical summaries only for visible cards. */
export default function DomainCommonMetric({domainId,batchId}:{domainId:string;batchId:string|null}) {
  const c=clarteCopy[useLang().lang], ref=useRef<HTMLDivElement>(null), [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(!ref.current) return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}});
    observer.observe(ref.current); return ()=>observer.disconnect();
  },[]);
  const resource=useDomainResource<BatchSummary>(visible&&batchId ? `domains/${domainId}/batches/${batchId}` : null, activeStatus);
  const data=resource.error ? null : resource.data, pending=data&&["QUEUED","RUNNING"].includes(data.status);
  const measured=!!data&&(data.counts.completePages+data.counts.partialPages>0);
  return <div ref={ref} className={s.commonMetric}><dt>{c.common}</dt><dd>{measured ? data.commonFindings.length : "—"}</dd>
    <dd className={s.metricHint}>{!batchId||resource.error ? c.summaryAbsent : !data||pending ? c.pending : !measured ? c.summaryAbsent : data.counts.completePages!==data.counts.selectedPages ? c.partial : ""}</dd>

  </div>;
}
