"use client";
import { inputHints } from "@/lib/input-hints";
import type { FormEventHandler } from "react";
import Link from "@/components/LocalizedLink";
import { useDomainText } from "./DomainUi";
import s from "../Connected.module.scss";
import d from "./Domains.module.scss";
export default function DomainPageFilters({ query, base, onSubmit }: { query: URLSearchParams; base: string; onSubmit: FormEventHandler<HTMLFormElement> }) {
  const { c, lang } = useDomainText();
  const select = (key: string, label: string, options: Record<string,string>, fallback = "", all = true) => <label key={key}>{label}<select aria-label={label} name={key} defaultValue={query.get(key) ?? fallback}>
    {all && <option value="">{c.all}</option>}{Object.entries(options).map(([value,text]) => <option key={value} value={value}>{text}</option>)}
  </select></label>;
  const advanced = ["severity","status","completeness"].filter(key => query.has(key));
  return <form className={d.pageFilters} onSubmit={onSubmit}>
    <div className={d.filters}>
      <label>{c.query}<input name="query" type="search" placeholder={inputHints[lang].searchUrl} maxLength={2048} defaultValue={query.get("query") ?? ""}/></label>
      {select("scope",c.scopeFilter,{ all:c.all,problematic:c.priority,incomplete:c.incomplete },"all",false)}
      {select("sort",c.sort,{priority:c.prioritySort,url:c.urlSort},"priority",false)}
    </div>
    <details className={d.advancedFilters} open={advanced.length > 0}>
      <summary>{lang === "fr" ? "Filtres avancés" : "Advanced filters"}{advanced.length > 0 ? ` (${advanced.length})` : ""}</summary>
      <div className={d.filters}>
        {select("severity",c.severity,c.severities)}
        {select("status",c.status,{QUEUED:c.states.QUEUED,RUNNING:c.states.RUNNING,COMPLETED:c.states.COMPLETED,FAILED:c.states.FAILED,CANCELED:c.states.CANCELED})}
        {select("completeness",c.completeness,{FULL:c.states.FULL,PARTIAL:c.states.PARTIAL,NONE:c.states.NONE,UNKNOWN:c.states.UNKNOWN})}
      </div>
    </details>
    <input type="hidden" name="limit" value={query.get("limit") ?? "20"}/>
    {query.get("ruleKey") && <input type="hidden" name="rule" value={query.get("ruleKey")!}/>}
    {query.get("definitionVersion") && <input type="hidden" name="definitionVersion" value={query.get("definitionVersion")!}/>}
    <div className={s.actions}><button className={s.secondary}>{c.apply}</button><Link className={d.link} href={`${base}?tab=pages`}>{c.reset}</Link></div>
  </form>;
}
