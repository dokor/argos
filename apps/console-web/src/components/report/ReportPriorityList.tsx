"use client";
import {useLang} from "@/lib/i18n/LangContext";
import type {ReportModel} from "./reportModel";
import type {PriorityItem} from "./types";
import {findingContent} from "./findingCatalogue";
import {findingExplanation} from "./findingExplanation";
import {isAggregateFinding} from "./findingPresentation";
import {interpretationCopy} from "./reportInterpretation";
import s from "./ReportPriorityList.module.scss";
export default function ReportPriorityList({priorities,model,onSelectFinding,onDetails,locked=false,limit=3}:{priorities:PriorityItem[];model:ReportModel;onSelectFinding:(key:string)=>void;onDetails:()=>void;locked?:boolean;limit?:number}) {
 const {lang,t}=useLang(),fr=lang==="fr",copy=t.report.priorityCards;
 return <section className={s.section}><h2>{fr?"Par où commencer":"Where to start"}</h2>
 {!!priorities.length&&<p className={s.explanation}>{interpretationCopy[lang].actions}</p>}
 {!priorities.length&&<p>{copy.empty}</p>}
 <ol>{priorities.slice(0,limit).map((priority,index)=>{
 const resolution=model.priorities[index],findings=resolution?.findings??[],first=findings[0];
 const resolved=first&&findings.length===1?findingContent(first.issue,lang):undefined;
 const content=resolved&&!["Contrôle technique à examiner","Technical check to review"].includes(resolved.title)?resolved:undefined;
 const domain=priority.categoryKey??first?.domain;
 const aggregate=isAggregateFinding(priority.findingKey);
 const underlying=aggregate?model.findings.filter(f=>!isAggregateFinding(f.key)&&f.domain===domain&&f.key.startsWith(priority.findingKey!.split(".")[0]+".")&&!findings.some(resolved=>resolved.key===f.key)):[];
 const select=(event:React.MouseEvent<HTMLAnchorElement>,key:string)=>{event.preventDefault();onSelectFinding(key);};
 return <li key={index}><span className={s.rank}>{String(Number.isInteger(priority.rank)&&priority.rank!>0?priority.rank:index+1).padStart(2,"0")}</span><div>
 <p className={s.severity} data-severity={priority.severity}>{copy.severity[priority.severity as keyof typeof copy.severity]}{domain&&" · "+((copy.domains as Record<string,string>)[domain]??domain)}</p>
 <h3>{content?.title??priority.title}</h3><p className={s.impact}>{content?.impact??priority.impact}</p>
 {content&&first&&!locked&&<p className={s.nextStep}><strong>{fr?"Première étape : ":"First step: "}</strong>{findingExplanation(first.issue,lang).steps[0]}</p>}
 {aggregate&&<p className={s.explanation}>{interpretationCopy[lang].aggregate}</p>}
 {!locked&&findings.length>1&&<details><summary>{copy.groupedLabel} {findings.length}</summary>{findings.map(f=><a key={f.key} className={s.findingLink} href={`#${f.anchor}`} onClick={event=>select(event,f.key)}>{findingContent(f.issue,lang).title} →</a>)}</details>}
 {!locked&&underlying.length>0&&<div className={s.underlying}><p>{fr?"Constats détaillés du même outil":"Detailed findings from the same tool"}</p>{underlying.map(f=><a key={f.key} className={s.findingLink} aria-label={`${copy.seeFinding}: ${findingContent(f.issue,lang).title}`} href={`#${f.anchor}`} onClick={event=>select(event,f.key)}>{findingContent(f.issue,lang).title} →</a>)}</div>}
 {!locked&&resolution?.status!=="resolved"&&<p className={s.explanation}>{resolution?.status==="partial"?copy.partialFindings:copy.missingFinding}</p>}
 </div><a className={s.link} aria-label={locked?undefined:`${fr?"Voir le constat":"View finding"}: ${first?findingContent(first.issue,lang).title:priority.title}`} href={locked||!first?"?view=technical":`#${first.anchor}`} onClick={event=>{event.preventDefault();if(locked||!first)onDetails();else onSelectFinding(first.key);}}>{locked?(fr?"Voir les détails":"View details"):(fr?"Voir le constat":"View finding")} →</a></li>;
 })}</ol></section>;
}
