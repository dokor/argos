"use client";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { CiManagementError, type CiIssued } from "@/lib/ci-management-client";
import catalog from "@/lib/ci-error-catalog.json";
import c from "../Connected.module.scss";
import s from "./CiIntegrations.module.scss";

export function useCiText(){const {lang}=useLang();return(fr:string,en:string)=>lang==="fr"?fr:en;}
export type CiAction={title:string;description:string;run:()=>Promise<void>};
export type CiAsk=(action:CiAction)=>void;
export const docs={start:"https://github.com/dokor/argos/blob/342891798323c2917d886c0f23b8fae2ed2f8596/clients/ci/README.md",
  errors:"https://github.com/dokor/argos/blob/342891798323c2917d886c0f23b8fae2ed2f8596/docs/ci/errors.md",
  github:"https://github.com/dokor/argos/blob/342891798323c2917d886c0f23b8fae2ed2f8596/docs/ci/github-publication.md",
  gitlab:"https://github.com/dokor/argos/blob/342891798323c2917d886c0f23b8fae2ed2f8596/docs/ci/gitlab-publication.md"};
export function useCiDate(){const {lang}=useLang();return(v:string|null)=>v?new Intl.DateTimeFormat(lang,{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(v))+" UTC":lang==="fr"?"Jamais":"Never";}
export function CiCode({value,label}:{value:string;label:string}){
  const tx=useCiText(),[result,setResult]=useState<{value:string;ok:boolean}|null>(null);
  const message=result?.value===value?(result.ok?tx("Copié.","Copied."):tx("Copie indisponible : sélectionnez le texte.","Copy unavailable: select the text.")):"";
  async function copy(){try{await navigator.clipboard.writeText(value);setResult({value,ok:true});}catch{setResult({value,ok:false});}}
  return <div className={s.code}><div><span>{label}</span><button type="button" className={c.secondary} onClick={()=>void copy()}>{tx("Copier","Copy")}</button></div><pre role="region" aria-label={label} tabIndex={0}><code>{value}</code></pre><span role="status">{message}</span></div>;
}
export function CiError({error,mutation,onRead,busy}:{error:CiManagementError;mutation:boolean;onRead:()=>void;busy:boolean}){
  const {lang}=useLang(),tx=useCiText(),entry=catalog.errors[error.code];
  function download(){
    const diagnostic={schemaVersion:1,code:error.code,stage:entry.stage,actionCode:entry.actionCode,requestId:error.requestId,retryAfterSeconds:error.retryAfterSeconds};
    const url=URL.createObjectURL(new Blob([JSON.stringify(diagnostic,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download="argos-ci-diagnostic.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className={s.error} role="alert" aria-labelledby="ci-error-title"><h2 id="ci-error-title">{entry[lang].message}</h2><p>{entry[lang].action}</p>
    <p><code>{error.code}</code> · {tx("Étape","Stage")} : {entry.stage}{error.requestId&&<> · {error.requestId}</>}{error.retryAfterSeconds!==null&&<> · {tx("Attente minimale","Minimum wait")} : {error.retryAfterSeconds}s</>}</p>
    {mutation&&<p>{tx("Le résultat de la modification peut être inconnu. Actualisez les lectures avant toute nouvelle action ; ne recréez pas automatiquement une clé ou une preuve.","The change may have an unknown outcome. Refresh reads before taking another action; do not automatically recreate a key or proof.")}</p>}
    <div className={c.actions}><button className={c.secondary} disabled={busy} onClick={onRead}>{tx("Actualiser les lectures","Refresh reads")}</button><button className={c.secondary} onClick={download}>{tx("Exporter le diagnostic minimal","Export minimal diagnostic")}</button><a href={docs.errors} referrerPolicy="no-referrer">{tx("Guide de dépannage","Troubleshooting guide")}</a></div>
  </section>;
}
export function CiSecret({issued,onClose}:{issued:CiIssued;onClose:()=>void}){
  const tx=useCiText(),dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const trigger=document.activeElement as HTMLElement|null,el=dialog.current;el?.showModal();return()=>{el?.close();if(trigger?.isConnected&&trigger!==document.body&&!trigger.matches(":disabled"))trigger.focus();else document.getElementById("ci-section-keys")?.focus();};},[]);
  return <dialog ref={dialog} className={s.dialog} data-ci-secret aria-labelledby="ci-secret-title" aria-describedby="ci-secret-help" onCancel={e=>{e.preventDefault();onClose();}}>
    <h2 id="ci-secret-title">{tx("Copiez votre nouvelle clé maintenant","Copy your new key now")}</h2><p id="ci-secret-help">{tx("Elle ne sera plus affichée. Enregistrez-la dans le secret protégé ARGOS_API_KEY de votre CI. Ne la partagez pas dans un ticket, une capture ou un fichier du dépôt.","It will not be shown again. Save it in your protected ARGOS_API_KEY CI secret. Do not share it in an issue, screenshot or repository file.")}</p>
    <CiCode value={issued.credential} label="ARGOS_API_KEY"/><button autoFocus className={c.primary} onClick={onClose}>{tx("J’ai enregistré la clé","I saved the key")}</button>
  </dialog>;
}
