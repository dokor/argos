"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import type { BatchSummary } from "@/lib/connected/contracts";
import { activeStatus, useDomainResource } from "./useDomainResource";
import s from "./Domains.module.scss";

const copy = {
  fr: { common: "Problèmes communs", unavailable: "Synthèse indisponible", pending: "Synthèse en cours", partial: "Sur les pages évaluées", profile: "Profil", contract: "contrat", score: "score", retry: "Réessayer la synthèse" },
  en: { common: "Common findings", unavailable: "Summary unavailable", pending: "Summary in progress", partial: "Across evaluated pages", profile: "Profile", contract: "contract", score: "score", retry: "Retry summary" },
};

/** Read canonical rules only when the card enters the viewport; never infer them from page counts. */
export default function DomainCommonMetric({ domainId, batchId }: { domainId: string; batchId: string | null }) {
  const { lang } = useLang(), c = copy[lang];
  const ref = useRef<HTMLDivElement>(null), [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      // Support environments without the visibility API through the same observed state transition.
      queueMicrotask(() => setVisible(true));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const resource = useDomainResource<BatchSummary>(visible && batchId ? `domains/${domainId}/batches/${batchId}` : null, activeStatus);
  const data = resource.error ? null : resource.data;
  const measured = !!data && data.counts.completePages + data.counts.partialPages > 0;
  const hint = !batchId || resource.error ? c.unavailable
    : !data || activeStatus(data) ? c.pending
    : !measured ? c.unavailable
    : data.counts.completePages !== data.counts.selectedPages ? c.partial : "";
  return <div ref={ref} className={s.commonMetric}>
    <dt>{c.common}</dt>
    <dd>{measured ? new Intl.NumberFormat(lang).format(data.commonFindings.length) : "—"}</dd>
    {(hint || data || resource.error) && <dd className={s.metricHint}>
      {hint && <span>{hint}</span>}
      {data && <span>{c.profile} : {data.profileSnapshot.profileId} · {c.contract} v{data.profileSnapshot.contractVersion} · {c.score} v{data.profileSnapshot.scoringVersion}</span>}
      {resource.error && <button type="button" className={s.link} onClick={resource.reload}>{c.retry}</button>}
    </dd>}
  </div>;
}
