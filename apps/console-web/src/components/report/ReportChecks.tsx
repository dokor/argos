"use client";
import { useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { cleanEvidence } from "./findingCatalogue";
import { coverageAction, coverageCopy } from "./coverageExplanation";
import type { Report } from "./types";
import s from "./ReportChecks.module.scss";

/** Inventory is explicit backend evidence. Never infer a pass from a missing issue. */
export default function ReportChecks({report}:{report:Report}) {
  const {lang,t}=useLang(), fr=lang==="fr";
  const checks=report.diagnostics?.version==="report-diagnostics-v1"?report.diagnostics.checks:undefined;
  const [state,setState]=useState(()=>checks?.some(check=>check.state==="UNAVAILABLE")?"UNAVAILABLE":"PASSED");
  const labels:Record<string,string>=fr?{PASSED:"Réussis",UNAVAILABLE:"Non mesurés",NOT_APPLICABLE:"Non applicables",INFORMATION:"Informations"}:
    {PASSED:"Passed",UNAVAILABLE:"Not measured",NOT_APPLICABLE:"Not applicable",INFORMATION:"Information"};
  const domains=t.report.priorityCards.domains as Record<string,string>;
  return <details className={s.inventory}>
    <summary>{fr?"Contrôles réussis et limites de l’analyse":"Passed checks and analysis limitations"}</summary>
    {!checks?<p>{fr?"Ce rapport historique ne conserve pas le résultat de chaque contrôle. L’absence d’un problème dans la liste ne prouve pas que le contrôle a réussi.":"This historical report does not retain every check result. A missing finding does not prove that a check passed."}</p>:<>
      <p>{fr?"Un contrôle réussi ne demande pas de correction. Un contrôle non mesuré ne permet pas de conclure sur l’état de la page. Cet inventaire couvre les contrôles conservés par Argos, pas tous les audits internes de chaque outil.":"A passed check needs no fix. An unmeasured check cannot establish the page’s condition. This inventory covers checks retained by Argos, not every internal audit performed by each tool."}</p>
      <div className={s.filters} role="group" aria-label={fr?"Résultat du contrôle":"Check result"}>
        {Object.entries(labels).map(([key,label])=><button type="button" key={key} aria-pressed={state===key} onClick={()=>setState(key)}>{label} · {checks.filter(check=>check.state===key).length}</button>)}
      </div>
      <p role="status">{checks.filter(check=>check.state===state).length} {fr?"contrôle(s)":"check(s)"} · {labels[state]}</p>
      <ul>{checks.filter(check=>check.state===state).map(check=>{
        const coverage=report.scores.coverage?.checks.find(item=>item.key===check.key);
        return <li key={check.key}>
        <strong>{cleanEvidence(check.title)||check.key}</strong>
        <span>{domains[check.domain]??check.domain} · {check.source}</span>
        <code>{check.key}</code>
        {check.state==="UNAVAILABLE"&&<p>{coverageCopy[lang].reasons[coverage?.reason??""] ?? (fr?"La collecte n’a pas fourni de résultat exploitable pour ce contrôle.":"Collection did not provide a usable result for this check.")} {coverageAction(coverage?.state??"UNAVAILABLE",coverage?.reason??"MEASUREMENT_MISSING",lang)}</p>}
      </li>})}</ul>
    </>}
  </details>;
}
