"use client";
import { intlLocale } from "@/lib/i18n/locales";
import { localizeValue } from "@/lib/i18n/messages";
import WebTip from "@/components/editorial/WebTip";
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
  const {lang}=useLang(),session=useAccountSession();
  const [days,setDays]=useState(30),[group,setGroup]=useState('day'),[revision,setRevision]=useState(0);
  const [result,setResult]=useState<{key:string;data:TrafficMetrics|null;error:boolean}|null>(null);
  const allowed=session.ready&&!session.denied&&session.profile?.verified&&session.profile.admin;
  const key=`${days}:${group}:${revision}`,data=allowed&&result?.key===key?result.data:null;
  useEffect(()=>{if(!allowed)return;const controller=new AbortController();void accountFetch<TrafficMetrics>(`admin/traffic?days=${days}&group=${group}`,'GET',undefined,controller.signal).then(data=>{if(!controller.signal.aborted)setResult({key,data,error:false});}).catch(()=>{if(!controller.signal.aborted)setResult({key,data:null,error:true});});return()=>controller.abort();},[allowed,days,group,key]);
  const date=(value:string)=>new Intl.DateTimeFormat(intlLocale(lang),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value));
  const number=(value:number)=>new Intl.NumberFormat(intlLocale(lang)).format(value);
  const sources:Record<string,string>=(lang === "fr" ? {direct:'Direct / inconnu',search:'Moteurs',referral:'Liens référents',campaign:'Campagnes',internal:'Navigation interne'} : localizeValue({direct:'Direct / unknown',search:'Search engines',referral:'Referrals',campaign:'Campaigns',internal:'Internal navigation'}, lang));
  const table=(title:string,rows:{value:string;views:number}[],labels?:Record<string,string>)=><section><h2>{title}</h2>{!rows.length?<p>{(lang === "fr" ? 'Aucune page vue mesurée sur cette période.' : localizeValue('No measured page views in this period.', lang))}</p>:<div className={s.scroll} tabIndex={0} role="region" aria-label={title}><table><thead><tr><th scope="col">{title}</th><th scope="col">{(lang === "fr" ? 'Pages vues' : localizeValue('Page views', lang))}</th></tr></thead><tbody>{rows.map(r=><tr key={r.value}><th scope="row">{labels?.[r.value]??r.value}</th><td>{number(r.views)}</td></tr>)}</tbody></table></div>}</section>;
  return <main className={`${s.main} ${t.traffic}`}><Link href="/account/admin">{(lang === "fr" ? 'Administration' : localizeValue('Administration', lang))}</Link><h1>{(lang === "fr" ? 'Statistiques · Trafic' : localizeValue('Statistics · Traffic', lang))}</h1>
    <WebTip/>
    {!session.ready?<p role="status">{(lang === "fr" ? 'Chargement…' : localizeValue('Loading…', lang))}</p>:!allowed?<p role="alert">{(lang === "fr" ? 'Accès administrateur requis.' : localizeValue('Administrator access required.', lang))}</p>:<>
      <AdminNavigation active="analytics"/><StatisticsNavigation active="traffic"/>
      <p>{(lang === "fr" ? 'Pages publiques uniquement. Mesure facultative avec consentement, indépendante des comptes et des analyses réalisées.' : localizeValue('Public pages only. Optional consented measurement, independent of accounts and completed analyses.', lang))}</p>
      <div className={s.controls}><label htmlFor="traffic-days">{(lang === "fr" ? 'Période' : localizeValue('Period', lang))}</label><select id="traffic-days" value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,90].map(n=><option key={n} value={n}>{n} {(lang === "fr" ? 'jours' : localizeValue('days', lang))}</option>)}</select><label htmlFor="traffic-group">{(lang === "fr" ? 'Regrouper par' : localizeValue('Group by', lang))}</label><select id="traffic-group" value={group} onChange={e=>setGroup(e.target.value)}>{[['day',(lang === "fr" ? 'Jour' : localizeValue('Day', lang))],['week',(lang === "fr" ? 'Semaine' : localizeValue('Week', lang))],['month',(lang === "fr" ? 'Mois' : localizeValue('Month', lang))]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button onClick={()=>setRevision(v=>v+1)}>{(lang === "fr" ? 'Actualiser' : localizeValue('Refresh', lang))}</button></div>
      {result?.key===key&&result.error?<p role="alert">{(lang === "fr" ? 'Statistiques indisponibles. Réessayez.' : localizeValue('Statistics unavailable. Try again.', lang))}</p>:!data?<p role="status">{(lang === "fr" ? 'Chargement…' : localizeValue('Loading…', lang))}</p>:<>
        <p>{data.enabled?((lang === "fr" ? 'Collecte configurée côté serveur' : localizeValue('Server collection configured', lang))):((lang === "fr" ? 'Collecte désactivée côté serveur' : localizeValue('Server collection disabled', lang)))} · {date(data.from)} → {date(data.until)} (UTC)</p>
        <dl><div><dt>{(lang === "fr" ? 'Pages vues mesurées' : localizeValue('Measured page views', lang))}</dt><dd>{number(data.views)}</dd></div><div><dt>{(lang === "fr" ? 'Visites mesurées' : localizeValue('Measured visits', lang))}</dt><dd>{number(data.visits)}</dd></div></dl>
        <p>{(lang === "fr" ? 'Une visite = première page consentie d’une session du navigateur. Ce compteur ne mesure pas des personnes uniques. Les onglets simultanés peuvent le surestimer.' : localizeValue('A visit is the first consented page of a browser session. This does not measure unique people. Simultaneous tabs may overcount visits.', lang))}</p>
        <h2>{(lang === "fr" ? 'Évolution' : localizeValue('Evolution', lang))}</h2><div data-evolution className={s.scroll} tabIndex={0} role="region" aria-label={(lang === "fr" ? 'Évolution du trafic' : localizeValue('Traffic evolution', lang))}><table><thead><tr><th scope="col">{(lang === "fr" ? 'Début de période UTC' : localizeValue('Period start UTC', lang))}</th><th scope="col">{(lang === "fr" ? 'Pages vues' : localizeValue('Page views', lang))}</th><th scope="col">{(lang === "fr" ? 'Visites' : localizeValue('Visits', lang))}</th></tr></thead><tbody>{data.evolution.map(r=><tr key={r.date}><th scope="row">{date(r.date)}</th><td>{number(r.views)}</td><td>{number(r.visits)}</td></tr>)}</tbody></table></div>
        {table((lang === "fr" ? 'Pages les plus consultées' : localizeValue('Most viewed pages', lang)),data.pages)}{table((lang === "fr" ? 'Sources des pages vues' : localizeValue('Page view sources', lang)),data.sources,sources)}{table((lang === "fr" ? 'Langues' : localizeValue('Languages', lang)),data.languages)}
        <p>{(lang === "fr" ? 'Couverture limitée : refus, bloqueurs et erreurs réseau réduisent les chiffres. Aucun historique avant activation. Jour courant incomplet ; zones privées, administration, bots usuels, polling et préchargements exclus. Les UTM sont réduits à la catégorie campagne, sans valeur enregistrée.' : localizeValue('Limited coverage: refusals, blockers and network errors reduce counts. No history before activation. Current day is incomplete; private pages, administration, common bots, polling and prefetches are excluded. UTM values are reduced to a campaign category and never recorded.', lang))}</p>
      </>}
    </>}
  </main>;
}
