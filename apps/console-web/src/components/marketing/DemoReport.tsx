"use client";
import {useState} from "react";
import {useLang} from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import {demoReport,DEMO_VERSION} from "./reportDemoFixture";
import s from "./DemoReport.module.scss";
export default function DemoReport(){
 const {lang}=useLang(),fr=lang==="fr";const [partial,setPartial]=useState(false);
 return <section className={s.demo} aria-label={fr?"Exemple de rapport":"Example report"}>
 <h2>{fr?"Prévisualisez le rapport Argos":"Preview the Argos report"}</h2>
 <p className={s.notice}>{fr?"Données fictives : scores, couverture et valeurs de la mosaïque illustrent la présentation, sans exécution réelle. Les trois preuves HTML sont détaillées plus bas.":"Fictional data: scores, coverage and mosaic values illustrate the layout, without a real run. The three HTML examples are explained below."} <small>{DEMO_VERSION}</small></p>
 <fieldset className={s.scenarios}><legend>{fr?"Scénario illustré":"Illustrated scenario"}</legend>{[false,true].map(value=><label key={String(value)}><input type="radio" name="demo-scenario" checked={partial===value} onChange={()=>setPartial(value)}/><span>{value?(fr?"Couverture partielle":"Partial coverage"):(fr?"Couverture complète":"Complete coverage")}</span></label>)}</fieldset>
 <ReportPage params={{report:demoReport(lang,partial)}} demo embedded/>
 </section>;
}
