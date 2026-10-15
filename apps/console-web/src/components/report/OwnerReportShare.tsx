"use client";
import {useState} from "react";
import {accountFetch} from "@/lib/account-client";
import {useLang} from "@/lib/i18n/LangContext";
import s from "./ReportActions.module.scss";
export default function OwnerReportShare({runId}:{runId:string}) {
 const {lang}=useLang(),fr=lang==="fr";
 const [days,setDays]=useState(30),[link,setLink]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function create(){setBusy(true);setMessage("");try{const value=await accountFetch<{token:string}>(`runs/${runId}/share`,"POST",{days});setLink(window.location.origin+(fr?"":"/en")+"/share/"+value.token);}catch{setMessage(fr?"Le lien n’a pas pu être créé. Réessayez.":"The link could not be created. Try again.");}finally{setBusy(false);}}
 async function revoke(){setBusy(true);try{await accountFetch(`runs/${runId}/share`,"DELETE");setLink("");setMessage(fr?"Le partage est désactivé.":"Sharing disabled.");}catch{setMessage(fr?"La désactivation a échoué. Réessayez.":"Disabling failed. Try again.");}finally{setBusy(false);}}
 return <div className={s.share}><details><summary>{fr?"Partager ce rapport":"Share this report"}</summary><div className={s.sharePanel}><p>{fr?"Synthèse publique, détails après connexion. Ce lien ouvre uniquement cette analyse en lecture seule ; votre historique reste privé.":"Public summary, details after sign-in. This link opens only this analysis in read-only mode; your history stays private."}</p>
 <label>{fr?"Validité du lien":"Link validity"}<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={30}>{fr?"30 jours":"30 days"}</option><option value={7}>{fr?"7 jours":"7 days"}</option><option value={0}>{fr?"Jusqu’à expiration du rapport":"Until the report expires"}</option></select></label><p>{fr?"Créer un nouveau lien remplace le précédent. Un PDF téléchargé ne peut pas être révoqué.":"Creating a new link replaces the previous one. Downloaded PDFs cannot be revoked."}</p>
 <nav><button disabled={busy} onClick={create}>{fr?"Créer le lien de partage":"Create shared link"}</button><button disabled={busy} onClick={revoke}>{fr?"Désactiver le partage":"Disable sharing"}</button></nav>
 {link&&<><label>{fr?"Lien de partage":"Shared link"}<input readOnly value={link} onFocus={e=>e.target.select()}/></label><nav><button onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage(fr?"Lien copié.":"Link copied.");}catch{setMessage(fr?"Sélectionnez et copiez le lien ci-dessus.":"Select and copy the link above.");}}}>{fr?"Copier le lien":"Copy link"}</button><a href={link} target="_blank" rel="noopener noreferrer">{fr?"Aperçu destinataire":"Recipient preview"}</a></nav></>}<p className={s.status} role="status">{message}</p></div></details></div>;
}
