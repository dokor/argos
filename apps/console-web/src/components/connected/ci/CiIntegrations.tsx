"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/LocalizedLink";
import { accountFetch, type SignInMethod } from "@/lib/account-client";
import { ciManagement, CiManagementError, type CiChallenge, type CiIssued, type CiKeys, type CiStatus, type CiTarget } from "@/lib/ci-management-client";
import { useAccountSession } from "@/components/account/AccountSession";
import ConfirmAccountAction from "@/components/account/ConfirmAccountAction";
import { PageHeading, StatusBadge } from "../Primitives";
import CiKeyManager from "./CiKeyManager";
import CiTargetsManager from "./CiTargetsManager";
import CiConfiguration from "./CiConfiguration";
import { CiCode, CiError, CiSecret, docs, useCiDate, useCiText, type CiAction } from "./CiUi";
import c from "../Connected.module.scss";
import s from "./CiIntegrations.module.scss";

export default function CiIntegrations(){
  const tx=useCiText(),date=useCiDate(),{profile,usage}=useAccountSession();
  const [tab,setTab]=useState("keys"),[status,setStatus]=useState<CiStatus|null>(null),[keys,setKeys]=useState<CiKeys>({items:[],integrations:[],nextCursor:null});
  const [targets,setTargets]=useState<CiTarget[]>([]),[targetCursor,setTargetCursor]=useState<string|null>(null),[methods,setMethods]=useState<SignInMethod[]>([]);
  const [error,setError]=useState<CiManagementError|null>(null),[mutationError,setMutationError]=useState(false),[notice,setNotice]=useState<"saved"|"secretLost"|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
  const [creating,setCreating]=useState(false),[challenge,setChallenge]=useState<CiChallenge|null>(null),[issued,setIssued]=useState<CiIssued|null>(null),[action,setAction]=useState<CiAction|null>(null),[now,setNow]=useState(()=>Date.now());
  const alive=useRef(false),lock=useRef(false),disclosure=useRef(0),request=useRef(0);
  const load=useCallback(async(signal?:AbortSignal)=>{
    const revision=++request.current;
    try{
      const [snapshot,keyPage,targetPage,signInMethods]=await Promise.all([ciManagement<CiStatus>("status","GET",undefined,signal),ciManagement<CiKeys>("keys","GET",undefined,signal),
        ciManagement<{items:CiTarget[];nextCursor:string|null}>("targets","GET",undefined,signal),accountFetch<SignInMethod[]>("methods","GET",undefined,signal)]);
      if(alive.current&&!signal?.aborted&&revision===request.current){setStatus(snapshot);setKeys(keyPage);setTargets(targetPage.items);setTargetCursor(targetPage.nextCursor);setMethods(signInMethods);setLoaded(true);setError(null);setNow(Date.now());}
    }catch(e){if(alive.current&&!signal?.aborted&&revision===request.current){setStatus(null);setError(e instanceof CiManagementError?e:new CiManagementError("TRANSPORT_FAILED"));}throw e;}
  },[]);
  useEffect(()=>{
    alive.current=true;const controller=new AbortController();
    queueMicrotask(()=>{
      if(controller.signal.aborted)return;
      if(profile?.verified)void load(controller.signal).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
      else setLoading(false);
    });
    const clear=()=>{disclosure.current++;setIssued(null);setChallenge(null);};
    const hidden=()=>{if(document.visibilityState==="hidden")clear();};
    window.addEventListener("pagehide",clear);document.addEventListener("visibilitychange",hidden);
    const timer=setInterval(()=>setNow(Date.now()),30000);
    return()=>{alive.current=false;controller.abort();clearInterval(timer);window.removeEventListener("pagehide",clear);document.removeEventListener("visibilitychange",hidden);};
  },[load,profile?.verified]);
  async function act(work:()=>Promise<void>,mutation=false){
    if(lock.current)return;lock.current=true;setBusy(true);setError(null);setMutationError(mutation);setNotice(null);
    try{await work();if(mutation){await load();if(alive.current)setNotice(v=>v==="secretLost"?v:"saved");}}
    catch(e){if(alive.current){if(mutation){setStatus(null);setCreating(false);}setError(e instanceof CiManagementError?e:new CiManagementError("TRANSPORT_FAILED"));}}
    finally{lock.current=false;if(alive.current){setBusy(false);if(mutation)requestAnimationFrame(()=>{if(alive.current&&document.activeElement===document.body&&!document.querySelector("dialog[open]"))document.getElementById("ci-section-"+tab)?.focus();});}}
  }
  const canConfirm=!!profile?.verified&&(!!profile.email||methods.some(m=>m.provider==="password"&&m.usable));
  const blocked=busy||loading||!!issued||!canConfirm;
  const eligible=!!status?.eligible&&!!status.validUntil&&Date.parse(status.validUntil)>now&&canConfirm;
  const canCreate=eligible&&!!status?.limits&&(keys.integrations.length<status.limits.activeKeys||keys.integrations.some(i=>i.canReplace));
  const ask=(next:CiAction)=>{if(blocked||lock.current)return;setError(null);setAction(next);};
  function reveal(value:CiIssued,generation:number){if(alive.current&&disclosure.current===generation&&document.visibilityState!=="hidden")setIssued(value);else if(alive.current)setNotice("secretLost");}
  const secretGeneration=useRef(0);
  const askKey=(next:CiAction)=>{secretGeneration.current=disclosure.current;ask(next);};
  return <main className={c.page}>
    <p className={s.eyebrow}>Premium · {tx("Automatisation","Automation")}</p>
    <PageHeading title={tx("Clés API et CI","API keys and CI")} description={tx("Des accès limités aux domaines et aux actions que vous autorisez.","Access limited to the domains and actions you authorize.")} showTip={false}
      action={<button id="ci-create-key" className={c.primary} disabled={!canCreate||blocked} onClick={()=>{setTab("keys");setCreating(true);}}>{tx("Créer une clé","Create key")}</button>}/>
    <section className={s.access} aria-label={tx("Accès CI Premium","Premium CI access")}>
      <StatusBadge tone={eligible?"success":"warning"}>{loading?tx("Chargement…","Loading…"):!status?tx("État d’accès inconnu","Access status unknown"):!status.enabled?tx("Préversion · accès CI fermé","Preview · CI access closed"):eligible?tx("Accès CI actif","CI access active"):tx("Accès CI indisponible","CI access unavailable")}</StatusBadge>
      <p>{eligible?tx("Droit valable jusqu’au ","Access valid until ")+date(status!.validUntil):status&&!status.enabled?tx("L’accès CI reste fermé jusqu’à la recette complète.","CI access stays closed until full acceptance testing."):tx("Actualisez vos droits ou consultez votre offre avant de créer un accès.","Refresh your access or review your plan before creating access.")}</p>
      <Link href="/account/usage">{tx("Offre et quotas du compte","Account plan and quotas")}</Link>
    </section>
    {status?.limits?<ul className={s.terms}><li><strong>{status.limits.monthlyAnalysesPerKey}</strong> {tx("analyses / mois / intégration de clé","analyses / month / key integration")}</li><li><strong>{status.limits.activeKeys}</strong> {tx("clés incluses","included keys")}</li><li>{status.limits.verifiedTargets===null?tx("Domaines vérifiés illimités","Unlimited verified domains"):status.limits.verifiedTargets+tx(" domaines vérifiés"," verified domains")}</li><li>{status.limits.concurrentRuns} {status.limits.concurrentRuns===1?tx("audit simultané","concurrent audit"):tx("audits simultanés","concurrent audits")} · {status.limits.keyLifetimeYears} {status.limits.keyLifetimeYears===1?tx("an maximum par clé","year maximum per key"):tx("ans maximum par clé","years maximum per key")}</li></ul>:
      status&&!status.enabled&&<p className={s.terms}>{tx("Paramètres prévus : 30 analyses/mois par intégration de clé, 3 clés, domaines vérifiés illimités, 1 audit simultané, clé valable un an maximum.","Planned terms: 30 analyses/month per key integration, 3 keys, unlimited verified domains, 1 concurrent audit, keys valid for at most one year.")}</p>}
    <p className={s.hint}>{tx("Un contrôle confirmé réserve deux analyses ensemble. Chaque rapport produit compte, même partiel.","A confirmed check reserves two analyses together. Every produced report counts, including partial reports.")}</p>
    {eligible&&!canCreate&&<p className={s.hint}>{tx("Tous les emplacements sont occupés. Renouvelez une clé, ou révoquez-la puis réutilisez explicitement son emplacement.","All slots are occupied. Rotate a key, or revoke it and explicitly reuse its slot.")}</p>}
    <details className={s.accountDetails}><summary>{tx("Consommation et offre","Usage and plan")}</summary><p className={s.hint}>{tx("Les deux mesures s’exécutent en séquence. Sans rapport, la réservation est libérée. La rotation ne remet pas le quota à zéro.","The two samples run sequentially. Without a report, its reservation is released. Rotation does not reset the quota.")}</p>
      {usage&&<p className={s.hint}>{tx("Registre commun du compte : ","Shared account ledger: ")}{usage.used} {tx("utilisées","used")} · {usage.reserved} {tx("réservées","reserved")}{usage.available!==null&&<> · {usage.available} {tx("disponibles","available")}</>}. {tx("Le quota de chaque intégration et celui du compte sont tous deux contrôlés à l’admission.","Both integration and account quotas are checked at admission.")}</p>}
      <p className={s.hint}>{tx("Souscription en préparation : EUR, mensuel ou annuel avec remise à définir ; prix principal HT avec mention du TTC. Aucun tarif ni paiement n’est activé.","Subscriptions in preparation: EUR, monthly or annual with a discount to be decided; main price excluding VAT, with the VAT-inclusive price stated. No price or payment is active.")}</p>
    </details>
    {!profile?.verified&&<p className={s.notice}><Link href="/account/settings">{tx("Vérifier l’adresse email du compte pour gérer ses accès.","Verify your account email to manage access.")}</Link></p>}
    {loaded&&!canConfirm&&profile?.verified&&<p className={s.notice}><Link href="/account/settings">{tx("Configurez un moyen de réauthentification dans votre compte avant une modification sensible.","Configure an account reauthentication method before making a sensitive change.")}</Link></p>}
    {error&&<CiError error={error} mutation={mutationError} busy={busy||loading} onRead={()=>void act(()=>load())}/>}
    {notice&&<p role="status" className={s.notice}>{notice==="saved"?tx("Modification enregistrée.","Change saved."):tx("La clé a été créée, mais son secret a été masqué parce que la page n’était plus visible. Actualisez la liste puis renouvelez ou révoquez cette clé ; son secret ne peut pas être relu.","The key was created, but its secret was hidden because the page was no longer visible. Refresh the list, then rotate or revoke that key; its secret cannot be read again.")}</p>}
    <nav className={s.tabs} aria-label={tx("Gestion CI","CI management")}>{[["keys",tx("Clés API","API keys")],["targets",tx("Domaines autorisés","Allowed domains")],["config",tx("Configuration CI","CI configuration")]].map(([id,label])=><button id={"ci-section-"+id} key={id} type="button" aria-pressed={tab===id} onClick={()=>{setTab(id);setChallenge(null);}}>{label}</button>)}</nav>
    <div aria-busy={busy||loading}>
      {loading&&<p role="status" className={s.empty}>{tx("Chargement de vos accès…","Loading your access…")}</p>}
      {tab==="keys"&&loaded&&<CiKeyManager keys={keys} status={status} targets={targets} eligible={eligible} busy={blocked} creating={creating} onCreateClose={()=>setCreating(false)} ask={askKey} reveal={v=>reveal(v,secretGeneration.current)} now={now}
        onMore={()=>void act(async()=>{const page=await ciManagement<CiKeys>("keys?after="+keys.nextCursor);if(alive.current)setKeys(k=>({...page,items:[...k.items,...page.items.filter(v=>!k.items.some(old=>old.id===v.id))]}));})}/>}
      {tab==="targets"&&loaded&&<CiTargetsManager targets={targets} challenge={challenge} onChallenge={v=>{if(alive.current&&document.visibilityState!=="hidden")setChallenge(v);}} eligible={eligible} busy={blocked} ask={ask} now={now} hasMore={!!targetCursor}
        onMore={()=>void act(async()=>{const page=await ciManagement<{items:CiTarget[];nextCursor:string|null}>("targets?after="+targetCursor);if(alive.current){setTargets(t=>[...t,...page.items.filter(v=>!t.some(old=>old.id===v.id))]);setTargetCursor(page.nextCursor);}})}/>}
      {tab==="config"&&<CiConfiguration/>}
    </div>
    <div className={s.help}><section><h2>{tx("Tester la connexion dans votre CI","Test the connection in your CI")}</h2><p>{tx("Avec le client vérifié et ARGOS_API_KEY / ARGOS_TARGET_URL déjà configurés dans le runner protégé :","With the verified client and ARGOS_API_KEY / ARGOS_TARGET_URL already configured in the protected runner:")}</p><CiCode value="node argos-ci.mjs doctor" label={tx("Précontrôle en lecture seule","Read-only preflight")}/><p className={s.hint}>{tx("Aucun audit, crédit réservé ou ticket. READY ne garantit pas la capacité future. Aucun secret n’est saisi dans ce navigateur. Un audit au résultat ambigu se reprend avec resume et l’intention initiale.","No audit, reserved credit or issue. READY does not guarantee future capacity. No secret is entered in this browser. Resume an ambiguous audit with resume and its original intention.")}</p></section>
      <section><h2>{tx("Documentation développeur","Developer documentation")}</h2><p>{tx("Installation épinglée, contrats API, permissions minimales et dépannage dans le guide versionné en ligne.","Pinned installation, API contracts, minimum permissions and troubleshooting in the online versioned guide.")}</p><a className={c.secondary} href={tx(docs.start,docs.start.replace("README.md","README.en.md"))} referrerPolicy="no-referrer">{tx("Lire le guide CI versionné","Read the versioned CI guide")}</a></section>
    </div>
    {action&&profile&&<ConfirmAccountAction title={action.title} description={action.description} hasPassword={methods.some(m=>m.provider==="password"&&m.usable)} hasEmail={!!profile.email} onCancel={()=>setAction(null)}
      onConfirm={async()=>{const work=action.run;setAction(null);await act(work,true);}}/>}
    {issued&&<CiSecret issued={issued} onClose={()=>setIssued(null)}/>}
  </main>;
}
