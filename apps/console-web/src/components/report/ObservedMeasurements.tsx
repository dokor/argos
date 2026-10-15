import type { Report } from "./types";
import type { Lang } from "@/lib/i18n/routes";
import s from "./ObservedMeasurements.module.scss";

type Key = keyof NonNullable<Report["measurements"]>;
type Metric = { key: Key; fr: string; en: string; unit?: "s" | "ms" | "bytes"; thresholds?: [number,number] };
const groups: { fr:string; en:string; metrics:Metric[] }[] = [
  {fr:"Chargement",en:"Loading",metrics:[
    {key:"lcpMs",fr:"Contenu principal · LCP",en:"Main content · LCP",unit:"s",thresholds:[2500,4000]},
    {key:"fcpMs",fr:"Premier affichage · FCP",en:"First paint · FCP",unit:"s",thresholds:[1800,3000]},
    {key:"responseMs",fr:"Réponse HTTP",en:"HTTP response",unit:"ms"},
    {key:"loadMs",fr:"Chargement de la page",en:"Page load",unit:"s"}]},
  {fr:"Ressources",en:"Resources",metrics:[
    {key:"transferredBytes",fr:"Poids transféré estimé",en:"Estimated transferred size",unit:"bytes"},
    {key:"requests",fr:"Requêtes réseau",en:"Network requests"},
    {key:"htmlBytes",fr:"Document HTML",en:"HTML document",unit:"bytes"},
    {key:"scripts",fr:"Scripts dans le HTML",en:"Scripts in HTML"}]},
  {fr:"Erreurs",en:"Errors",metrics:[
    {key:"jsErrors",fr:"Erreurs JavaScript",en:"JavaScript errors"},
    {key:"consoleErrors",fr:"Erreurs console",en:"Console errors"},
    {key:"failedRequests",fr:"Requêtes échouées",en:"Failed requests"},
    {key:"http4xx",fr:"Réponses HTTP 4xx",en:"HTTP 4xx responses"},
    {key:"http5xx",fr:"Réponses HTTP 5xx",en:"HTTP 5xx responses"}]}];
export function measured(value:unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
export function measurementLevel(value:number, thresholds:[number,number]) { return value<=thresholds[0]?0:value<=thresholds[1]?1:2; }

/** Also rendered in PDF: no session/context dependency and no invented missing values. */
export default function ObservedMeasurements({report,lang}:{report:Report;lang:Lang}) {
  const fr=lang==="fr",levels=fr?["Bon","À améliorer","Mauvais"]:["Good","Needs improvement","Poor"];
  const format=(n:number)=>n.toLocaleString(lang,{maximumFractionDigits:2});
  return <section className={s.section} aria-label={fr?"Mesures observées":"Observed measurements"}>
    <header className={s.heading}><h2>{fr?"Mesures observées":"Observed measurements"}</h2><span>{fr?"13 mesures · Lors de cette analyse":"13 measurements · During this analysis"}</span></header>
    {groups.map((group,index)=><section className={s.group} key={group.en} aria-label={group[lang]}>
      <header><h3>{group[lang]}</h3><span>{group.metrics.length} {fr?"mesures":"measurements"}</span></header>
      <dl className={`${s.grid} ${index===2?s.errors:""}`}>{group.metrics.map(metric=>{
        const raw=report.measurements?.[metric.key],available=measured(raw),value=available?raw:0;
        const unit=metric.unit==="bytes"?(value>=1e6?(fr?"Mo":"MB"):(fr?"Ko":"kB")):metric.unit;
        const display=metric.unit==="s"?value/1000:metric.unit==="bytes"?value/(value>=1e6?1e6:1000):value;
        const thresholds=metric.thresholds,level=thresholds?measurementLevel(value,thresholds):0;
        const position=thresholds?value<=thresholds[0]?value/thresholds[0]*100/3:value<=thresholds[1]?100/3+(value-thresholds[0])/(thresholds[1]-thresholds[0])*100/3:200/3+Math.min((value-thresholds[1])/thresholds[1],1)*100/3:0;
        return <div key={metric.key} className={`${s.tile} ${thresholds?s.major:index===0?s.secondary:""}`}>
          <dt>{metric[lang]}</dt><dd><div className={s.result}>{available?<span className={s.value}>{format(display)}{unit&&<small> {unit}</small>}</span>:<span className={s.missing}>{fr?"Non mesuré":"Not measured"}</span>}
            {thresholds&&available&&<span className={`${s.status} ${s["level"+level]}`}>{levels[level]}</span>}</div>
            {thresholds&&(available?<><div className={s.meter} aria-hidden="true"><span/><span/><span/><i style={{left:Math.max(1,Math.min(99,position))+"%"}}/></div><div className={s.ranges}><span>≤ {format(thresholds[0]/1000)} s</span><span>{format(thresholds[0]/1000)}–{format(thresholds[1]/1000)} s</span><span>&gt; {format(thresholds[1]/1000)} s</span></div></>:<><div className={s.empty} aria-hidden="true"/><p className={s.caption}>{fr?"Aucun niveau attribué":"No level assigned"}</p></>)}
          </dd></div>;
      })}</dl>
    </section>)}
    <footer className={s.note}><p>{fr?"Repères FCP/LCP : Web Vitals · Mesures de laboratoire ponctuelles. La réponse HTTP inclut les redirections ; le poids HTML est celui du texte UTF-8 analysé.":"FCP/LCP thresholds: Web Vitals · Point-in-time lab measurements. HTTP response includes redirects; HTML size is the analysed UTF-8 text size."}</p><p>{fr?"Non mesuré : donnée indisponible. Les compteurs d’erreurs peuvent se recouper.":"Not measured: unavailable data. Error counts may overlap."}</p>
      <div className={s.legend}>{levels.map((label,i)=><span key={label}><i className={s["dot"+i]} aria-hidden="true"/>{label}</span>)}</div>
    </footer>
  </section>;
}
