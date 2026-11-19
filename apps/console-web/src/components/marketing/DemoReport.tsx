"use client";
import { localizeValue } from "@/lib/i18n/messages";
import {useState} from "react";
import {useLang} from "@/lib/i18n/LangContext";
import ReportPage from "@/app/(fr)/report/[token]/ReportPage";
import {demoReport,DEMO_VERSION} from "./reportDemoFixture";
import s from "./DemoReport.module.scss";
export default function DemoReport(){
 const {lang}=useLang();const [partial,setPartial]=useState(false);
 return <section className={s.demo} aria-label={(lang === "fr" ? "Exemple de rapport" : localizeValue("Example report", lang))}>
 <h2>{(lang === "fr" ? "Prévisualisez le rapport Argos" : localizeValue("Preview the Argos report", lang))}</h2>
 <p className={s.notice}>{(lang === "fr" ? "Données fictives : scores, couverture et valeurs de la mosaïque illustrent la présentation, sans exécution réelle. Les trois preuves HTML sont détaillées plus bas." : localizeValue("Fictional data: scores, coverage and mosaic values illustrate the layout, without a real run. The three HTML examples are explained below.", lang))} <small>{DEMO_VERSION}</small></p>
 <fieldset className={s.scenarios}><legend>{(lang === "fr" ? "Scénario illustré" : localizeValue("Illustrated scenario", lang))}</legend>{[false,true].map(value=><label key={String(value)}><input type="radio" name="demo-scenario" checked={partial===value} onChange={()=>setPartial(value)}/><span>{value?((lang === "fr" ? "Couverture partielle" : localizeValue("Partial coverage", lang))):((lang === "fr" ? "Couverture complète" : localizeValue("Complete coverage", lang)))}</span></label>)}</fieldset>
 <ReportPage params={{report:demoReport(lang,partial)}} demo embedded/>
 </section>;
}
