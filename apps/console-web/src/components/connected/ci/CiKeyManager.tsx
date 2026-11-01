"use client";
import { useEffect, useRef, useState } from "react";
import { ciManagement, ciKeyState, type CiIssued, type CiKey, type CiKeys, type CiStatus, type CiTarget } from "@/lib/ci-management-client";
import { StatusBadge } from "../Primitives";
import { useCiText, useCiDate, type CiAsk } from "./CiUi";
import c from "../Connected.module.scss";
import s from "./CiIntegrations.module.scss";

const scopes=["audits:write","results:read","usage:read"];
export default function CiKeyManager({keys,status,targets,eligible,busy,creating,onCreateClose,ask,reveal,onMore,now}:{keys:CiKeys;status:CiStatus|null;targets:CiTarget[];eligible:boolean;busy:boolean;creating:boolean;onCreateClose:()=>void;ask:CiAsk;reveal:(value:CiIssued)=>void;onMore:()=>void;now:number}){
  const tx=useCiText(),date=useCiDate(),nameRef=useRef<HTMLInputElement>(null);
  const [name,setName]=useState(""),[targetIds,setTargetIds]=useState<string[]>([]),[permissions,setPermissions]=useState(scopes),[integrationId,setIntegrationId]=useState(""),[expiresAt,setExpiresAt]=useState("");
  useEffect(()=>{if(creating)nameRef.current?.focus();},[creating]);
  const verified=targets.filter(t=>t.state==="VERIFIED"&&t.validUntil&&Date.parse(t.validUntil)>now);
  const canAdd=!!status?.limits&&keys.integrations.length<status.limits.activeKeys;
  const validTargets=targetIds.length>0&&targetIds.length<=100&&targetIds.every(id=>verified.some(t=>t.id===id));
  function action(key:CiKey,rotate:boolean){ask({title:tx(rotate?"Renouveler la clé":"Révoquer la clé",rotate?"Rotate key":"Revoke key")+" · "+key.name,
    description:rotate?tx("La nouvelle clé garde le même quota et les mêmes domaines. L’ancienne reste utilisable quinze minutes au maximum.","The new key keeps the same quota and domains. The old key remains usable for at most fifteen minutes."):
      tx("La clé sera refusée immédiatement. Les résultats et la consommation de son intégration sont conservés.","The key will be rejected immediately. Its integration keeps its results and usage."),
    run:async()=>{if(rotate)reveal(await ciManagement<CiIssued>("keys/"+key.id+"/rotate","POST",{}));else await ciManagement("keys/"+key.id,"DELETE",{});}});}
  return <section className={s.section} aria-labelledby="ci-keys-title"><div className={s.sectionHeading}><div><h2 id="ci-keys-title">{tx("Vos clés API","Your API keys")}</h2><p className={s.hint}>{tx("Un secret limité, un historique et un quota par intégration.","A limited secret, history and quota for each integration.")}</p></div><span className={s.hint}>{keys.integrations.length} / {status?.limits?.activeKeys??"—"} {tx("emplacements","slots")}</span></div>
    {creating&&<form className={s.form} onSubmit={e=>{e.preventDefault();ask({title:tx("Créer cette clé API","Create this API key"),description:tx("Le secret sera affiché une seule fois. Enregistrez-le dans votre CI protégée. Les domaines et permissions choisis ne seront pas élargis automatiquement.","The secret is shown once. Save it in your protected CI. Selected domains and permissions will not be expanded automatically."),run:async()=>{
      reveal(await ciManagement<CiIssued>("keys","POST",{name,scopes:permissions,targetIds,...(integrationId?{integrationId}:{}),...(expiresAt?{expiresAt:expiresAt+"T00:00:00Z"}:{})}));
      onCreateClose();setName("");setTargetIds([]);setExpiresAt("");setIntegrationId("");
    }});}}>
      <h3>{tx("Nouvelle clé","New key")}</h3><div className={s.formColumns}><label>{tx("Nom de la clé","Key name")}<input ref={nameRef} required maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
      <label>{tx("Intégration et quota","Integration and quota")}<select aria-label={tx("Intégration et quota","Integration and quota")} value={integrationId} onChange={e=>setIntegrationId(e.target.value)} required={!canAdd} disabled={busy}><option value="" disabled={!canAdd}>{canAdd?tx("Nouvel emplacement","New slot"):tx("Choisir un emplacement réutilisable","Choose a reusable slot")}</option>{keys.integrations.filter(i=>i.canReplace).map(i=><option key={i.id} value={i.id}>{tx("Réutiliser l’emplacement ","Reuse slot ")}{i.slot}</option>)}</select></label></div>
      <p className={s.hint}>{tx("Une révocation ne libère pas un nouveau quota : réutilisez l’emplacement existant. Pour conserver l’accès à l’historique, gardez également son périmètre initial.","Revocation does not grant a new quota: reuse the existing slot. Keep its original scope to retain access to its history.")}</p>
      <fieldset><legend>{tx("Domaines vérifiés autorisés (100 maximum par clé)","Allowed verified domains (at most 100 per key)")}</legend>{verified.length?verified.map(t=><label className={s.check} key={t.id}><input type="checkbox" checked={targetIds.includes(t.id)} disabled={busy||!targetIds.includes(t.id)&&targetIds.length>=100} onChange={e=>setTargetIds(v=>e.target.checked?[...v,t.id]:v.filter(id=>id!==t.id))}/><span>{t.origin}</span></label>):<p>{tx("Vérifiez d’abord un domaine dans l’onglet Domaines autorisés.","First verify a domain in the Allowed domains section.")}</p>}</fieldset>
      <fieldset><legend>{tx("Permissions explicites","Explicit permissions")}</legend>{scopes.map(scope=><label className={s.check} key={scope}><input type="checkbox" checked={permissions.includes(scope)} disabled={busy} onChange={e=>setPermissions(v=>e.target.checked?[...v,scope]:v.filter(s=>s!==scope))}/><span><code>{scope}</code> · {scope==="audits:write"?tx("Lancer des analyses","Launch analyses"):scope==="results:read"?tx("Lire ses résultats","Read its results"):tx("Lire sa consommation","Read its usage")}</span></label>)}</fieldset>
      <label>{tx("Expiration UTC (facultative)","UTC expiry (optional)")}<input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} disabled={busy}/></label><p className={s.hint}>{tx("Sans date : au maximum un an calendaire UTC. Une date choisie expire à 00:00 UTC ; le serveur vérifie cette limite.","Without a date: at most one UTC calendar year. A chosen date expires at 00:00 UTC; the server checks this limit.")}</p>
      <div className={c.actions}><button className={c.primary} disabled={busy||!eligible||!name.trim()||!validTargets||!permissions.length||!canAdd&&!integrationId}>{tx("Continuer","Continue")}</button><button className={c.secondary} type="button" disabled={busy} onClick={onCreateClose}>{tx("Annuler","Cancel")}</button></div>
    </form>}
    {!keys.items.length&&<p className={s.empty}>{tx("Aucune clé créée. Vérifiez votre domaine, puis créez une clé limitée à cette cible.","No keys yet. Verify your domain, then create a key limited to that target.")}</p>}
    <div className={s.keyList}>{keys.items.map(key=>{const state=ciKeyState(key,now),usage=status?.integrations.find(i=>i.id===key.integrationId);return <article className={s.key} key={key.id}>
      <div><h3>{key.name}</h3><StatusBadge tone={state==="active"?"success":state==="overlap"?"warning":"neutral"}>{({active:tx("Active","Active"),overlap:tx("Transition de rotation","Rotation overlap"),expired:tx("Expirée","Expired"),revoked:tx("Révoquée","Revoked")})[state]}</StatusBadge><code className={s.publicId}>{key.id}</code><p className={s.hint}>{tx("Emplacement ","Slot ")}{key.slot}</p></div>
      <div className={s.grants}>{key.scopes.map(p=><code key={p}>{p}</code>)}<details><summary>{key.targets.length} {tx("domaine(s)","domain(s)")}</summary><ul>{key.targets.map(t=><li key={t.id}>{t.origin}</li>)}</ul></details></div>
      <div><p className={s.hint}>{tx("Expiration : ","Expires: ")}{date(key.expiresAt)}</p>{key.overlapUntil&&<p className={s.hint}>{tx("Fin de transition : ","Overlap ends: ")}{date(key.overlapUntil)}</p>}<p className={s.hint}>{tx("Dernière utilisation : ","Last used: ")}{date(key.lastUsedAt)}</p>{usage&&<p className={s.hint}>{usage.used} {tx("utilisées","used")} · {usage.reserved} {tx("réservées","reserved")}</p>}</div>
      <div className={s.rowActions}><button className={s.textButton} disabled={busy||!eligible||state!=="active"} onClick={()=>action(key,true)}>{tx("Renouveler","Rotate")}</button><button className={s.textButton} data-danger disabled={busy||state==="revoked"} onClick={()=>action(key,false)}>{tx("Révoquer","Revoke")}</button></div>
    </article>;})}</div>
    {keys.nextCursor&&<button className={c.secondary} disabled={busy} onClick={onMore}>{tx("Afficher les clés suivantes","Load more keys")}</button>}
    {status&&<p className={s.hint}>{tx("Période ","Period ")}{status.period} ({status.timezone}) · {tx("Renouvellement des crédits : ","Credits reset: ")}{date(status.resetsAt)}</p>}
  </section>;
}
