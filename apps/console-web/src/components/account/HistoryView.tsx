"use client";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { localizedPath } from "@/lib/i18n/routes";
import { accountFetch, AccountClientError } from "@/lib/account-client";
import Link from "@/components/LocalizedLink";
import WebTip from "@/components/editorial/WebTip";
import { useAccountSession } from "./AccountSession";
import HistoryActions from "./HistoryActions";
import { historyCopy } from "./historyCopy";
import { comparableDelta, type HistoryPage, type HistoryItem } from "./history";
import s from "./AccountView.module.scss";
import h from "./HistoryView.module.scss";

export function HistoryChart({ items }: { items: HistoryItem[] }) {
  const { lang } = useLang(), copy = historyCopy[lang];
  const points = [...items].reverse().map((item, i) => ({ item, x: 40 + i * 520 / Math.max(1, items.length - 1), y: 190 - (item.globalScore ?? 0) * 1.6 }));
  return <figure><figcaption>{copy.chart}</figcaption><p>{copy.chartHint}</p>
    <svg className={h.chart} viewBox="0 0 600 225" role="img" aria-label={copy.chart + ". " + copy.chartHint}>
      {[0,50,100].map(n => <g key={n}><text x="2" y={195-n*1.6}>{n}</text><line x1="32" y1={190-n*1.6} x2="570" y2={190-n*1.6} opacity=".2"/></g>)}
      {points.map((p,i) => { const previous=points[i-1]; return <g key={p.item.runId}>
        {previous && previous.item.globalScore !== null && p.item.globalScore !== null && comparableDelta(p.item) !== null && <line data-segment="comparable" x1={previous.x} y1={previous.y} x2={p.x} y2={p.y} strokeWidth="2"/>}
        {p.item.globalScore !== null && <circle cx={p.x} cy={p.y} r="5"><title>{new Date(p.item.createdAt).toLocaleString(lang)}: {p.item.globalScore}/100</title></circle>}
      </g>; })}
    </svg>
    {points.length>0 && <div className={h.chartDates}><time dateTime={points[0].item.createdAt}>{new Date(points[0].item.createdAt).toLocaleDateString(lang)}</time><time dateTime={points[points.length-1].item.createdAt}>{new Date(points[points.length-1].item.createdAt).toLocaleDateString(lang)}</time></div>}
  </figure>;
}

export default function HistoryView({ urlId }: { urlId: string }) {
  const { t, lang } = useLang(), copy=historyCopy[lang], session=useAccountSession();
  const allowed=session.ready && session.profile?.verified && !session.denied, invalidate=session.invalidate;
  const [page,setPage]=useState<{key:string;data:HistoryPage}|null>(null),[cursor,setCursor]=useState<string|null>(null),[revision,setRevision]=useState(0),[error,setError]=useState("");
  const key=urlId+":"+(cursor??"")+":"+revision;
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    queueMicrotask(()=>{if(alive){setPage(null);setError("");}});
    if(allowed) void accountFetch<HistoryPage>("urls/"+urlId+"/history"+(cursor ? "?cursor="+cursor : ""),"GET",undefined,controller.signal)
      .then(data=>{if(alive)setPage({key,data});}).catch(reason=>{if(alive){invalidate(reason);setError(reason instanceof AccountClientError ? reason.code : "account_unavailable");}});
    return ()=>{alive=false;controller.abort();};
  },[allowed,urlId,cursor,key,invalidate]);
  const data=allowed && page?.key===key ? page.data : null;
  const date=(raw:string)=>new Date(raw).toLocaleString(lang);
  return <><main className={s.page}>
    <Link href={data ? "/account/sites/"+data.context.siteId : "/account/sites"}>{data ? copy.back : copy.sites}</Link>
    <h1>{copy.title}</h1>
    <WebTip/>
    {!session.ready ? <p role="status">{copy.loading}</p> : !allowed ? <><p>{copy.private}</p><Link href={session.profile ? "/account" : "/account/sign-in?returnTo="+encodeURIComponent(localizedPath("/account/urls/"+urlId+"/history",lang))}>{session.profile ? t.account.verify : t.account.signIn}</Link></> : <>
      <p>{copy.intro}</p>
      {error ? <><p role="alert">{error==="resource_unavailable" || error==="cursor_invalid" ? copy.missing : t.account.errors.account_unavailable}</p><button className={s.button} onClick={()=>{setCursor(null);setRevision(v=>v+1);}}>{copy.retry}</button></> : !data ? <p role="status">{copy.loading}</p> : <>
        <h2 className={h.heading}>{data.context.normalizedUrl}</h2><HistoryActions context={data.context} launchBlocked={session.usage?.canLaunch===false}/>
        {data.items.length===0 ? <p>{copy.empty}</p> : <>
          <HistoryChart items={data.items}/>
          <ol className={h.list}>{data.items.map(item=>{const delta=comparableDelta(item);return <li className={s.card} key={item.runId}>
            <h3>{copy.date} <time dateTime={item.createdAt}>{date(item.createdAt)}</time></h3>
            <p>{t.account.statuses[item.status as keyof typeof t.account.statuses]??item.status}</p>
            <dl className={h.facts}><div><dt>{copy.score}</dt><dd>{item.globalScore===null ? copy.unavailable : item.globalScore+"/100"}</dd></div>
              <div><dt>{copy.method}</dt><dd>{item.scoringVersion===null ? copy.unknown : "v"+item.scoringVersion}</dd></div>
              <div><dt>{copy.coverage}</dt><dd>{item.coverage===null ? copy.unknown : Math.round(item.coverage*100)+" %"} — {item.provisional===null ? copy.unknown : item.provisional ? copy.partial : copy.full}</dd></div>
              <div><dt>{copy.delta}</dt><dd>{delta===null ? copy.reasons[item.comparison?.reason??"EVIDENCE_MISSING"] : (delta>0 ? "+" : "")+delta+" "+copy.points}</dd></div></dl>
            {item.publishedAt && <p>{copy.published} {date(item.publishedAt)}</p>}{item.expiresAt && <p>{copy.expires} {date(item.expiresAt)}</p>}
            {item.reportAvailable ? <Link href={"/account/runs/"+item.runId}>{copy.open}</Link> : <p>{t.account.sites.unavailable}</p>}
          </li>;})}</ol>
        </>}
        <div className={s.actions}>{cursor && <button className={s.button} onClick={()=>setCursor(null)}>{copy.first}</button>}{data.nextCursor && <button className={s.button} onClick={()=>setCursor(data.nextCursor)}>{copy.next}</button>}</div>
      </>}
    </>}
  </main></>;
}
