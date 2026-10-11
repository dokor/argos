"use client";

import { CategoryScore, Coverage } from "./types";
import { useLang } from "@/lib/i18n/LangContext";
import { BUSINESS_DOMAINS, type ReportModel } from "./reportModel";
import { domainScore } from "./reportSummaryModel";
import { decisionCopy } from "./decisionCopy";
import s from "./ScoreGrid.module.scss";

export default function ScoreGrid({ categories, model, coverage, onSelectDomain }: {
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
  return <section className={s.section} aria-labelledby="report-domains">
    <div className={s.sectionHead}>
      <div><h2 id="report-domains" className={s.sectionTitle}>{ts.title}</h2><p className={s.sectionDesc}>{ts.desc}</p></div>
    </div>
    <div className={s.grid}>
      {BUSINESS_DOMAINS.map(key => {
        const category = categories?.find(category => category.key === key);
        const score = domainScore(category?.score, key, coverage);
        const issues = model?.groups.find(group => group.key === key)?.findings.length ?? category?.issues ?? 0;
        const measurement = coverage?.domains.find(domain => domain.key === key);
        return <a key={key} href={href(key)} onClick={event => select(event, key)} className={s.card}>
          <div className={s.cardTop}>
            <div><h3 className={s.catLabel}>{domains[key]}</h3><p className={s.catIssues}>{issues} {ts.issueCount}</p></div>
            <span className={score === undefined ? s.missingScore : s.scoreValue}>{score === undefined ? copy.notEvaluated : `${score}/100`}</span>
          </div>
          <p className={s.catDesc}>{copy.domainDescriptions[key]}</p>
          {score !== undefined && <p className={s.availability}>{copy.domainScore}</p>}
          {measurement && <p className={s.availability}>{copy.domainCoverage}: {Math.round(measurement.ratio * 100)} %{!measurement.sufficient && ` — ${copy.insufficient}`}</p>}
          <span className={s.detailLink}>{ts.seeDetail}</span>
        </a>;
      })}
    </div>
    {!!unknown?.findings.length && <a className={s.unknownLink} href={href("unknown")} onClick={event => select(event, "unknown")}>
      {t.report.issuesByCategory.unknownDomain}: {unknown.findings.length} — {ts.seeDetail}
    </a>}
  </section>;
}
