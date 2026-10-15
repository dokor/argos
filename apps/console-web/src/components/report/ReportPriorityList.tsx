"use client";
import {useLang} from "@/lib/i18n/LangContext";
import type {ReportModel} from "./reportModel";
import type {PriorityItem} from "./types";
import {findingContent} from "./findingCatalogue";
import s from "./ReportPriorityList.module.scss";
export default function ReportPriorityList({priorities,model,onSelectFinding,onDetails,locked=false,limit=3}:{priorities:PriorityItem[];model:ReportModel;onSelectFinding:(key:string)=>void;onDetails:()=>void;locked?:boolean;limit?:number}) {
 const {lang,t}=useLang(),fr=lang==="fr",copy=t.report.priorityCards;
 return <section className={s.section}><h2>{fr?"Par où commencer":"Where to start"}</h2>
 {!priorities.length&&<p>{copy.empty}</p>}
 <ol>{priorities.slice(0,limit).map((priority,index)=>{
 const findings=model.priorities[index]?.findings??[],first=findings[0];
 const resolved=first&&findings.length===1?findingContent(first.issue,lang):undefined;
 const content=resolved&&!["Contrôle technique à examiner","Technical check to review"].includes(resolved.title)?resolved:undefined;
 const domain=priority.categoryKey??first?.domain;
 return <li key={index}><span className={s.rank}>{String(index+1).padStart(2,"0")}</span><div>
 <p className={s.severity} data-severity={priority.severity}>{copy.severity[priority.severity as keyof typeof copy.severity]}{domain&&" · "+((copy.domains as Record<string,string>)[domain]??domain)}</p>
 <h3>{content?.title??priority.title}</h3><p className={s.impact}>{content?.impact??priority.impact}</p>
 {!locked&&findings.length>1&&<details><summary>{copy.groupedLabel} {findings.length}</summary>{findings.map(f=><button key={f.key} onClick={()=>onSelectFinding(f.key)}>{findingContent(f.issue,lang).title} →</button>)}</details>}
 </div><a className={s.link} aria-label={locked?undefined:`${fr?"Voir le constat":"View finding"}: ${first?findingContent(first.issue,lang).title:priority.title}`} href={locked||!first?"?view=technical":`#${first.anchor}`} onClick={event=>{event.preventDefault();locked||!first?onDetails():onSelectFinding(first.key);}}>{locked?(fr?"Voir les détails":"View details"):(fr?"Voir le constat":"View finding")} →</a></li>;
 })}</ol></section>;
}
