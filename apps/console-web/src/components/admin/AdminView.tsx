"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import { useAccountSession, PersonalNavigation, type MonthlyUsage } from "@/components/account/AccountSession";
import { useLang } from "@/lib/i18n/LangContext";
import Link from "@/components/LocalizedLink";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import type { Report } from "@/components/report/types";
import { copy, type AdminCopy } from "./copy";
import s from "./AdminView.module.scss";
import { feedbackCopy } from "@/components/feedback/copy";
import { analyticsCopy } from "./analyticsCopy";

type Row={id:string;email?:string;displayName?:string;state?:string;role?:string;offer?:string;userId?:string;site?:string;status?:string;createdAt:string;reportAvailable?:number|boolean;actorId?:string;targetId?:string;oldOffer?:string;newOffer?:string;oldLimit?:number|null;newLimit?:number|null};
type Page={items:Row[];nextCursor:string|null};
type User=Row & {usage:MonthlyUsage;monthlyLimit:number|null;offers:string[]};
type Run=Row & {modules:Record<string,string>;failureCode:string|null;attempts:number};
function message(error:unknown,c:AdminCopy) {
 const code=error instanceof AccountClientError ? error.code : "";
 if(code==="reauth_required") return c.recent;
 if(code==="account_archived") return c.archived;
 if(code==="admin_target") return c.adminTarget;
 if(code==="resource_unavailable") return c.unavailable;
 if(error instanceof AccountClientError && error.status===400) return c.invalid;
 if(error instanceof AccountClientError && [401,403].includes(error.status)) return c.denied;
 return c.error;
}
function useResource<T>(path:string|null,onDenied:()=>void) {
 const [state,setState]=useState<{path:string;data:T|null;error:unknown}|null>(null),[revision,setRevision]=useState(0);
 const refresh=()=>setRevision(v=>v+1);
 useEffect(()=>{
  if(!path) return;
  const controller=new AbortController();let alive=true;
  queueMicrotask(()=>{if(alive)setState(null);});
  void accountFetch<T>(path,"GET",undefined,controller.signal).then(data=>{if(alive)setState({path,data,error:null});}).catch(error=>{
   if(!alive)return;
   if(error instanceof AccountClientError && [401,403].includes(error.status))onDenied();
   setState({path,data:null,error});
  });
  return ()=>{alive=false;controller.abort();};
 },[path,revision,onDenied]);
 return {data:state?.path===path?state.data:null,error:state?.path===path?state.error:null,loading:!!path && state?.path!==path,refresh};
}
const date=(raw:string,lang:string)=>new Date(raw).toLocaleString(lang==="fr"?"fr-FR":"en-GB",{timeZone:"UTC"})+" UTC";
function stateLabel(value:string|undefined,c:AdminCopy) {return value ? c.statuses[value as keyof typeof c.statuses]??value : "—";}
export default function AdminView({runId}:{runId?:string}) {
 const {lang,t}=useLang(),c=copy[lang],session=useAccountSession();
 const [denied,setDenied]=useState(false),[tab,setTab]=useState<"users"|"runs"|"events">("users");
 const [query,setQuery]=useState(""),[cursor,setCursor]=useState<string|null>(null),[userId,setUserId]=useState<string|null>(null);
 const [reportOpen,setReportOpen]=useState(false);
 const onDenied=useCallback(()=>setDenied(true),[]);
 const allowed=session.ready && !!session.profile?.admin && !session.denied && !denied;
 const queue=useResource<{queued:number;running:number}>(allowed?"admin/queue":null,onDenied);
 const path=allowed&&!runId?"admin/"+tab+"?"+new URLSearchParams({limit:"20",...Object.fromEntries(new URLSearchParams(query)),...(cursor?{cursor}:{})}):null;
 const list=useResource<Page>(path,onDenied);
 const run=useResource<Run>(allowed&&runId?"admin/runs/"+runId:null,onDenied);
 const report=useResource<Report>(allowed&&runId&&reportOpen?"admin/runs/"+runId+"/report":null,onDenied);
 function filters(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const values=new URLSearchParams();
  for(const [key,value] of new FormData(event.currentTarget))if(typeof value==="string"&&value.trim())values.set(key,value.trim());
  setQuery(values.toString());setCursor(null);setUserId(null);list.refresh();
 }
 function switchTab(next:typeof tab){setTab(next);setCursor(null);setQuery("");setUserId(null);}
 const table=<div className={s.table} tabIndex={0} role="region" aria-label={c[tab]}><table>
  <caption>{c[tab]}</caption><thead><tr>{(tab==="users"?[c.user,c.state,c.offer,c.actions]:tab==="runs"?[c.site,c.user,c.status,c.date,c.actions]:[c.actor,c.target,c.change,c.date]).map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
  <tbody>{list.data?.items.map(row=><tr key={row.id}>{tab==="users"?<>
   <td>{row.displayName}<br/>{row.email}<br/><small>{row.id}</small></td><td>{stateLabel(row.state,c)}<br/>{stateLabel(row.role,c)}</td><td>{row.offer}</td><td><button id={"admin-user-"+row.id} onClick={()=>setUserId(row.id)} aria-label={c.profile+" "+(row.displayName??row.email??row.id)}>{c.profile}</button></td>
  </>:tab==="runs"?<>
   <td>{row.site??"—"}<br/><small>{row.id}</small></td><td>{row.userId??c.anonymous}</td><td>{stateLabel(row.status,c)}</td><td>{date(row.createdAt,lang)}</td><td><Link href={"/account/admin/runs/"+row.id}>{c.detail}</Link></td>
  </>:<>
   <td>{row.actorId}</td><td>{row.targetId}</td><td>{row.oldOffer} / {row.oldLimit??c.defaultLimit} → {row.newOffer} / {row.newLimit??c.defaultLimit}</td><td>{date(row.createdAt,lang)}</td>
  </>}</tr>)}</tbody>
 </table></div>;
 if(allowed&&report.data)return <><div className={s.returnBar}><Link href="/account/admin">{c.back}</Link></div><ReportPage params={{report:report.data}}/></>;
 return <><SiteNav/><PersonalNavigation/><main className={s.page}>
  <h1>{c.title}</h1><p>{c.intro}</p>{allowed && <div className={s.actions}><Link href="/account/admin/feedback">{feedbackCopy[lang].admin}</Link><Link href="/account/admin/analytics">{analyticsCopy[lang].title}</Link></div>}
  {!session.ready?<p role="status">{c.loading}</p>:!allowed?<><p role="alert">{c.denied}</p><Link href="/account/sign-in">{c.signIn}</Link></>:runId?<>
   <Link href="/account/admin">{c.back}</Link>
   {run.loading&&<p role="status">{c.loading}</p>}{run.error!=null&&<p role="alert">{message(run.error,c)}</p>}
   <button onClick={run.refresh}>{c.refresh}</button>
   {run.data&&<section className={s.card}><h2>{run.data.site??run.data.id}</h2><p>{stateLabel(run.data.status,c)} · {c.attempts}: {run.data.attempts}</p>
    {run.data.failureCode&&<p className={s.notice}>{c.failed}</p>}<h3>{c.modules}</h3>
    <dl>{Object.entries(run.data.modules).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{t.report.progress.status[value as keyof typeof t.report.progress.status]??stateLabel(value,c)}</dd></div>)}</dl>
    {!!run.data.reportAvailable&&<button onClick={()=>{setReportOpen(true);report.refresh();}}>{c.report}</button>}
    {report.loading&&<p role="status">{c.loading}</p>}{report.error!=null&&<p role="alert">{message(report.error,c)}</p>}
   </section>}
  </>:<>
   <section className={s.card} aria-label={c.queued}><dl className={s.metrics}><div><dt>{c.queued}</dt><dd>{queue.data?.queued??"—"}</dd></div><div><dt>{c.running}</dt><dd>{queue.data?.running??"—"}</dd></div></dl><p>{c.queueHelp}</p>{queue.error!=null&&<p role="alert">{message(queue.error,c)}</p>}<button onClick={()=>{queue.refresh();list.refresh();}}>{c.refresh}</button></section>
   <nav className={s.nav} aria-label={c.title}>{(["users","runs","events"] as const).map(key=><button key={key} aria-pressed={tab===key} onClick={()=>switchTab(key)}>{c[key]}</button>)}</nav>
   {tab!=="events"&&<form key={tab+query} className={s.filters} onSubmit={filters}>
    {tab==="users"?<>
     <label>{c.search}<input name="q" maxLength={100} defaultValue={new URLSearchParams(query).get("q")??""}/></label>
     <label>{c.state}<select name="state" defaultValue={new URLSearchParams(query).get("state")??""}><option value="">{c.all}</option>{["ACTIVE","PENDING","ARCHIVED"].map(v=><option key={v} value={v}>{stateLabel(v,c)}</option>)}</select></label>
     <label>{c.offer}<input name="offer" maxLength={16} defaultValue={new URLSearchParams(query).get("offer")??""}/></label>
    </>:<>
     <label>{c.user}<input name="user" defaultValue={new URLSearchParams(query).get("user")??""} placeholder="ID / anonymous"/></label>
     <label>{c.site}<input name="site" maxLength={253} defaultValue={new URLSearchParams(query).get("site")??""}/></label>
     <label>{c.status}<select name="status" defaultValue={new URLSearchParams(query).get("status")??""}><option value="">{c.all}</option>{["QUEUED","RUNNING","COMPLETED","FAILED"].map(v=><option key={v} value={v}>{stateLabel(v,c)}</option>)}</select></label>
     <label>{c.from}<input name="from" type="date" defaultValue={new URLSearchParams(query).get("from")??""}/></label><label>{c.until}<input name="until" type="date" defaultValue={new URLSearchParams(query).get("until")??""}/></label>
    </>}<button>{c.apply}</button>
   </form>}
   {userId&&<UserDetail key={userId} id={userId} c={c} onDenied={onDenied} onClose={()=>{document.getElementById("admin-user-"+userId)?.focus();setUserId(null);}} onSaved={()=>{list.refresh();session.refreshUsage();}} onRuns={()=>{setTab("runs");setQuery("user="+userId);setUserId(null);setCursor(null);}}/>}
   {list.loading?<p role="status">{c.loading}</p>:list.error!=null?<p role="alert">{message(list.error,c)}</p>:list.data?.items.length?table:<p role="status">{c.empty}</p>}
   <div className={s.actions}><button disabled={!cursor||list.loading} onClick={()=>setCursor(null)}>{c.first}</button><button disabled={!list.data?.nextCursor||list.loading} onClick={()=>setCursor(list.data!.nextCursor)}>{c.next}</button></div>
  </>}
 </main><SiteFooter/></>;
}
function UserDetail({id,c,onDenied,onClose,onSaved,onRuns}:{id:string;c:AdminCopy;onDenied:()=>void;onClose:()=>void;onSaved:()=>void;onRuns:()=>void}) {
 const user=useResource<User>("admin/users/"+id,onDenied);
 const [notice,setNotice]=useState("");
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{panel.current?.focus();},[]);
 return <section ref={panel} tabIndex={-1} className={s.card} aria-label={c.profile}><div className={s.actions}><h2>{user.data?.displayName??c.user}</h2><button onClick={onClose}>{c.close}</button></div>
  {user.loading&&<p role="status">{c.loading}</p>}{user.error!=null&&<p role="alert">{message(user.error,c)}</p>}
  {notice&&<p role="status">{notice}</p>}
  {user.data&&<><p>{user.data.email} · {stateLabel(user.data.state,c)} · {stateLabel(user.data.role,c)}</p><dl className={s.metrics}>
   {[[c.used,user.data.usage.used],[c.reserved,user.data.usage.reserved],[c.limit,user.data.usage.limit??c.unlimited],[c.reset,user.data.usage.resetsAt+" ("+user.data.usage.timezone+")"]].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
  </dl><button onClick={onRuns}>{c.runs}</button>
  {user.data.state!=="ARCHIVED"&&<Entitlement user={user.data} c={c} onSaved={changed=>{setNotice(changed?c.saved:c.unchanged);user.refresh();onSaved();}} onDenied={onDenied}/>}
  </>}
 </section>;
}
function Entitlement({user,c,onSaved,onDenied}:{user:User;c:AdminCopy;onSaved:(changed:boolean)=>void;onDenied:()=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const values=new FormData(event.currentTarget);setBusy(true);setError(null);
  const raw=values.get("limit") as string,limit=raw===""?null:Number(raw);
  if(limit!==null&&(!Number.isSafeInteger(limit)||limit<0)){setError(new AccountClientError("payload_invalid",400));setBusy(false);return;}
  try {
   const response=await accountFetch<{changed:boolean}>("admin/users/"+user.id+"/entitlement","PATCH",{offer:values.get("offer"),monthlyLimit:limit,confirmed:values.get("confirmed")==="on"});
   onSaved(response.changed);
  } catch(reason) {setError(reason);if(reason instanceof AccountClientError&&(reason.status===401||reason.code==="admin_required"))onDenied();}
  finally{setBusy(false);}
 }
 return <form onSubmit={save}><div className={s.filters}>
  <label>{c.offer}<select name="offer" defaultValue={user.offer}>{user.offers.map(offer=><option key={offer}>{offer}</option>)}</select></label>
  <label>{c.override}<input name="limit" type="number" min="0" max={Number.MAX_SAFE_INTEGER} step="1" defaultValue={user.monthlyLimit??""} aria-describedby="limit-help"/></label>
 </div><p id="limit-help">{c.inherit}</p><label className={s.check}><input type="checkbox" name="confirmed" required/>{c.confirm}</label>
 <div className={s.actions}><button disabled={busy}>{busy?c.loading:c.save}</button></div>{error!=null&&<p role="alert">{message(error,c)} {error instanceof AccountClientError&&error.code==="reauth_required"&&<Link href="/account/sign-in">{c.signIn}</Link>}</p>}
 </form>;
}
