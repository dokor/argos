"use client";

import { CategoryScore, Coverage } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { BUSINESS_DOMAINS, type ReportModel } from "./reportModel";
import { domainScore } from "./reportSummaryModel";
import { decisionCopy } from "./decisionCopy";
import s from "./ScoreGrid.module.scss";

export default function ScoreGrid({ categories, model, coverage, onSelectDomain, compact=false }: {
  compact?: boolean;
  categories: CategoryScore[]; model?: ReportModel; coverage?: Coverage | null;
  onSelectDomain?: (domain: string) => void;
}) {
  const { t, lang } = useLang();
  const ts = t.report.scoreGrid;
  const copy = decisionCopy[lang];
  const domains = t.report.priorityCards.domains as Record<string, string>;
  const unknown = model?.groups.find(group => group.key === "unknown");
  const href = (key: string) => onSelectDomain ? `?view=technical&domain=${key}` : `#cat-${key}`;
  const select = (event: React.MouseEvent<HTMLAnchorElement>, key: string) => {
    if (onSelectDomain) { event.preventDefault(); onSelectDomain(key); }
  };
  return <section className={compact?s.compact:s.section} aria-labelledby="report-domains">
    <div className={s.sectionHead}>
      <div><h2 id="report-domains" className={compact?s.srOnly:s.sectionTitle}>{ts.title}</h2>{!compact&&<p className={s.sectionDesc}>{ts.desc}</p>}</div>
    </div>
    <div className={s.grid}>
      {BUSINESS_DOMAINS.map(key => {
        const category = categories?.find(category => category.key === key);
        const score = domainScore(category?.score, key, coverage);
        const issues = model?.groups.find(group => group.key === key)?.findings.length ?? category?.issues ?? 0;
        const measurement = coverage?.domains.find(domain => domain.key === key);
        if(compact) return <a key={key} href={href(key)} onClick={event=>select(event,key)} className={s.card}>
          <div className={s.cardTop}><h3 className={s.catLabel}>{domains[key]}</h3><span className={score===undefined?s.missingScore:s.scoreValue}>{score??copy.notEvaluated}</span></div>
          <div className={s.track} aria-hidden="true"><span style={{width:score===undefined?"0":`${score}%`,background:score===undefined?undefined:score>=80?"var(--argos-measure-good)":score>=50?"var(--argos-measure-warning)":"var(--argos-error)"}}/></div>
          <p className={s.availability}>{issues} {issues===1?ts.issueCountOne:ts.issueCount} · {lang==="fr"?"Couverture":"Coverage"} {measurement?`${Math.round(measurement.ratio*100)} %`:"—"}</p>
          {measurement&&!measurement.sufficient&&<p className={s.availability}>{copy.insufficient}</p>}
        </a>;
        return <a key={key} href={href(key)} onClick={event => select(event, key)} className={s.card}>
          <div className={s.cardTop}>
            <div><h3 className={s.catLabel}>{domains[key]}</h3><p className={s.catIssues}>{issues} {issues === 1 ? ts.issueCountOne : ts.issueCount}</p></div>
            <span className={score === undefined ? s.missingScore : s.scoreValue}>{score === undefined ? copy.notEvaluated : `${score}/100`}</span>
          </div>
          {!compact&&<p className={s.catDesc}>{copy.domainDescriptions[key]}</p>}
          {!compact&&score !== undefined && <p className={s.availability}>{copy.domainScore}</p>}
          {measurement && <p className={s.availability}>{copy.domainCoverage}: {Math.round(measurement.ratio * 100)} %{!measurement.sufficient && ` — ${copy.insufficient}`}</p>}
          {measurement && !measurement.sufficient && <p className={s.catDesc}>{lang === "fr" ? "Cette note ne permet pas de conclure sur les contrôles non mesurés." : "This score does not support conclusions about unmeasured checks."}</p>}
          <span className={s.detailLink}>{ts.seeDetail}</span>
        </a>;
      })}
    </div>
    {!!unknown?.findings.length && <a className={s.unknownLink} href={href("unknown")} onClick={event => select(event, "unknown")}>
      {t.report.issuesByCategory.unknownDomain}: {unknown.findings.length} — {ts.seeDetail}
    </a>}
  </section>;
}
