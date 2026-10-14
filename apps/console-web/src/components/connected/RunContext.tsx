"use client";
import type { HistoryContext } from "@/components/account/history";
import { useLang } from "@/lib/i18n/LangContext";
import { StatusBadge } from "./Primitives";
import { analysisCopy } from "./analysisCopy";
import s from "./Analysis.module.scss";
export type PersonalRun={status:string;siteId:string|null;historyContext?:HistoryContext;createdAt?:string;startedAt?:string|null;finishedAt?:string|null;moduleStatuses?:string|{id:string;status:string}[]|null;profileSnapshot?:string|null;reportAvailability?:"PENDING"|"AVAILABLE"|"EXPIRED"|"UNAVAILABLE"};
function object(value:unknown):Record<string,unknown> {
  try {const data=typeof value==="string" ? JSON.parse(value) : value;return data&&typeof data==="object"&&!Array.isArray(data) ? data : {};} catch{return {};}
}
export default function RunContext({run,runId,complete=false}:{run:PersonalRun;runId:string;complete?:boolean}) {
  const {lang}=useLang(),c=analysisCopy[lang];
  const profile=object(run.profileSnapshot);
  let modules:Record<string,unknown>={};
  try { const raw=typeof run.moduleStatuses==="string" ? JSON.parse(run.moduleStatuses) : run.moduleStatuses;
    if(Array.isArray(raw)) modules=Object.fromEntries(raw.filter(item=>item && typeof item.id==="string").map(item=>[item.id,item.status]));
  } catch { /* Missing execution data is not a successful measurement. */ }
  const states:Record<string,string>={PENDING:c.pending,RUNNING:c.running,COMPLETED:c.completed,FAILED:c.failed,SKIPPED:c.skipped};
  const names:Record<string,string>={http:"HTTP",html:"HTML",runtime:"Runtime",lighthouse:"Lighthouse",observatory:"Observatory",ssl:"TLS",zap:"ZAP",tech:lang==="fr" ? "Technologies" : "Technology"};
  const date=(raw?:string|null)=>raw&&Number.isFinite(new Date(raw).getTime()) ? new Date(raw).toLocaleString(lang) : c.unknown;
  return <section className={s.context} aria-labelledby="run-context"><h2 id="run-context">{c.context}</h2><p>{c.run} #{runId}</p>{run.historyContext && <p>{run.historyContext.normalizedUrl}</p>}
    <dl className={s.facts}>{[[c.created,date(run.createdAt)],[c.started,date(run.startedAt)],[c.finished,date(run.finishedAt)],[c.requested,typeof profile.profileId==="string" ? profile.profileId : c.unknown]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {complete ? <><p>{c.versionsHint}</p><h3>{c.evidence}</h3><p>{c.evidenceHint}</p></> : <><h3>{c.execution}</h3>{Object.keys(modules).length ? <ul className={s.modules}>{Object.entries(modules).filter(([name])=>name in names).map(([name,state])=><li key={name}><span>{names[name]}</span><StatusBadge tone={state==="FAILED" ? "danger" : state==="COMPLETED" ? "success" : "neutral"}>{typeof state==="string" ? states[state]??c.unknown : c.unknown}</StatusBadge></li>)}</ul> : <p>{c.unknown}</p>}<p>{c.executionHint}</p></>}
  </section>;
}
