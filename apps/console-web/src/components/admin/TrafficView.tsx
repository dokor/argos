"use client";
import { useEffect, useState } from "react";
import Link from "@/components/LocalizedLink";
import { useLang } from "@/lib/i18n/LangContext";
import { useAccountSession } from "@/components/account/AccountSession";
import { accountFetch } from "@/lib/account-client";
import AdminNavigation from "./AdminNavigation";
import StatisticsNavigation from "./StatisticsNavigation";
import s from "./AnalyticsView.module.scss";
import t from "./TrafficView.module.scss";
export type TrafficMetrics={enabled:boolean;from:string;until:string;views:number;visits:number;evolution:{date:string;views:number;visits:number}[];pages:{value:string;views:number}[];sources:{value:string;views:number}[];languages:{value:string;views:number}[]};
export default function TrafficView(){
  const {lang}=useLang(),fr=lang==='fr',session=useAccountSession();
  const [days,setDays]=useState(30),[group,setGroup]=useState('day'),[revision,setRevision]=useState(0);
  const [result,setResult]=useState<{key:string;data:TrafficMetrics|null;error:boolean}|null>(null);
  const allowed=session.ready&&!session.denied&&session.profile?.verified&&session.profile.admin;
  const key=`${days}:${group}:${revision}`,data=allowed&&result?.key===key?result.data:null;
  useEffect(()=>{if(!allowed)return;const controller=new AbortController();void accountFetch<TrafficMetrics>(`admin/traffic?days=${days}&group=${group}`,'GET',undefined,controller.signal).then(data=>{if(!controller.signal.aborted)setResult({key,data,error:false});}).catch(()=>{if(!controller.signal.aborted)setResult({key,data:null,error:true});});return()=>controller.abort();},[allowed,days,group,key]);
  const date=(value:string)=>new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
  const number=(value:number)=>new Intl.NumberFormat(lang).format(value);
  const sources:Record<string,string>=fr?{direct:'Direct / inconnu',search:'Moteurs',referral:'Liens référents',campaign:'Campagnes',internal:'Navigation interne'}:{direct:'Direct / unknown',search:'Search engines',referral:'Referrals',campaign:'Campaigns',internal:'Internal navigation'};
  const table=(title:string,rows:{value:string;views:number}[],labels?:Record<string,string>)=><section><h2>{title}</h2>{!rows.length?<p>{fr?'Aucune page vue mesurée sur cette période.':'No measured page views in this period.'}</p>:<div className={s.scroll} tabIndex={0} role="region" aria-label={title}><table><thead><tr><th scope="col">{title}</th><th scope="col">{fr?'Pages vues':'Page views'}</th></tr></thead><tbody>{rows.map(r=><tr key={r.value}><th scope="row">{labels?.[r.value]??r.value}</th><td>{number(r.views)}</td></tr>)}</tbody></table></div>}</section>;
  return <main className={`${s.main} ${t.traffic}`}><Link href="/account/admin">{fr?'Administration':'Administration'}</Link><h1>{fr?'Statistiques · Trafic':'Statistics · Traffic'}</h1>
    {!session.ready?<p role="status">{fr?'Chargement…':'Loading…'}</p>:!allowed?<p role="alert">{fr?'Accès administrateur requis.':'Administrator access required.'}</p>:<>
      <AdminNavigation active="analytics"/><StatisticsNavigation active="traffic"/>
      <p>{fr?'Pages publiques uniquement. Mesure facultative avec consentement, indépendante des comptes et des analyses réalisées.':'Public pages only. Optional consented measurement, independent of accounts and completed analyses.'}</p>
      <div className={s.controls}><label htmlFor="traffic-days">{fr?'Période':'Period'}</label><select id="traffic-days" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{n} {fr?'jours':'days'}</option>)}</select><label htmlFor="traffic-group">{fr?'Regrouper par':'Group by'}</label><select id="traffic-group" value={group} onChange={e=>setGroup(e.target.value)}>{[['day',fr?'Jour':'Day'],['week',fr?'Semaine':'Week'],['month',fr?'Mois':'Month']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button onClick={()=>setRevision(v=>v+1)}>{fr?'Actualiser':'Refresh'}</button></div>
      {result?.key===key&&result.error?<p role="alert">{fr?'Statistiques indisponibles. Réessayez.':'Statistics unavailable. Try again.'}</p>:!data?<p role="status">{fr?'Chargement…':'Loading…'}</p>:<>
        <p>{data.enabled?(fr?'Collecte configurée côté serveur':'Server collection configured'):(fr?'Collecte désactivée côté serveur':'Server collection disabled')} · {date(data.from)} → {date(data.until)} (UTC)</p>
        <dl><div><dt>{fr?'Pages vues mesurées':'Measured page views'}</dt><dd>{number(data.views)}</dd></div><div><dt>{fr?'Visites mesurées':'Measured visits'}</dt><dd>{number(data.visits)}</dd></div></dl>
        <p>{fr?'Une visite = première page consentie d’une session du navigateur. Ce compteur ne mesure pas des personnes uniques. Les onglets simultanés peuvent le surestimer.':'A visit is the first consented page of a browser session. This does not measure unique people. Simultaneous tabs may overcount visits.'}</p>
        <h2>{fr?'Évolution':'Evolution'}</h2><div data-evolution className={s.scroll} tabIndex={0} role="region" aria-label={fr?'Évolution du trafic':'Traffic evolution'}><table><thead><tr><th scope="col">{fr?'Début de période UTC':'Period start UTC'}</th><th scope="col">{fr?'Pages vues':'Page views'}</th><th scope="col">{fr?'Visites':'Visits'}</th></tr></thead><tbody>{data.evolution.map(r=><tr key={r.date}><th scope="row">{date(r.date)}</th><td>{number(r.views)}</td><td>{number(r.visits)}</td></tr>)}</tbody></table></div>
        {table(fr?'Pages les plus consultées':'Most viewed pages',data.pages)}{table(fr?'Sources des pages vues':'Page view sources',data.sources,sources)}{table(fr?'Langues':'Languages',data.languages)}
        <p>{fr?'Couverture limitée : refus, bloqueurs et erreurs réseau réduisent les chiffres. Aucun historique avant activation. Jour courant incomplet ; zones privées, administration, bots usuels, polling et préchargements exclus. Les UTM sont réduits à la catégorie campagne, sans valeur enregistrée.':'Limited coverage: refusals, blockers and network errors reduce counts. No history before activation. Current day is incomplete; private pages, administration, common bots, polling and prefetches are excluded. UTM values are reduced to a campaign category and never recorded.'}</p>
      </>}
    </>}
  </main>;
}
