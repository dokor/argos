"use client";
import {useEffect,useRef,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "@/components/LocalizedLink";
import {useLang} from "@/lib/i18n/LangContext";
import {useAccountSession} from "@/components/account/AccountSession";
import ConfirmAccountAction from "@/components/account/ConfirmAccountAction";
import {accountFetch,AccountClientError,type SignInMethod} from "@/lib/account-client";
import {billingRead,billingSync,billingDestination,BillingClientError} from "@/lib/billing-client";
import type {BillingCode,BillingSnapshot} from "@/lib/billing-contract";
import {PageHeading,StatusBadge,EmptyState} from "../Primitives";
import c from "../Connected.module.scss";
import s from "./BillingView.module.scss";

const errors:Partial<Record<BillingCode,readonly [string,string]>>={
  billing_disabled:["Les paiements sont désactivés. Les tarifs et la recette doivent être validés avant ouverture.","Payments are disabled. Pricing and acceptance must be approved before opening."],
  billing_configuration:["Le raccordement de facturation n’est pas prêt. Aucun nouveau paiement n’est proposé ; actualisez l’état plus tard.","Billing setup is not ready. No new payment is offered; refresh the status later."],
  billing_sync_pending:["La confirmation est différée. Actualisez d’abord l’état, puis retrouvez l’intention initiale sans créer une deuxième souscription.","Confirmation is delayed. Refresh the status first, then recover the original intention without creating a second subscription."],
  billing_existing_subscription:["Une souscription existe déjà chez Stripe. Actualisez depuis Stripe ou ouvrez le portail pour la gérer.","A subscription already exists at Stripe. Refresh from Stripe or open the portal to manage it."],
  billing_interval_locked:["La périodicité est liée au Checkout en cours. Actualisez l’état pour retrouver cette même session.","The interval is bound to the pending Checkout. Refresh the status to recover that same session."],
  billing_managed_elsewhere:["Cette offre est gérée en dehors de ce parcours. Aucune nouvelle souscription ne sera créée.","This plan is managed outside this flow. No new subscription will be created."],
  billing_payment_required:["Stripe attend une action de paiement. Consultez le portail sécurisé pour régulariser la souscription.","Stripe requires a payment action. Use the secure portal to resolve the subscription."],
  reauth_required:["Confirmez à nouveau votre identité avant cette action.","Confirm your identity again before this action."],
  rate_limited:["Trop de demandes. Respectez l’attente de 15 minutes avant une nouvelle tentative.","Too many requests. Wait 15 minutes before trying again."],
  email_unverified:["Vérifiez votre adresse email pour accéder à la facturation.","Verify your email address to access billing."],
  csrf_invalid:["La confirmation de session a expiré. Actualisez la page avant de reprendre.","Session confirmation expired. Refresh the page before continuing."],
  session_invalid:["Votre session a expiré. Reconnectez-vous pour consulter votre souscription.","Your session expired. Sign in again to view your subscription."],
};
const statuses:Record<BillingSnapshot["status"],readonly [string,string]>={
  NONE:["Aucune souscription Stripe","No Stripe subscription"],ACTIVE:["Premium actif","Premium active"],
  CANCEL_AT_PERIOD_END:["Annulation en fin de période","Cancellation at period end"],PAYMENT_REQUIRED:["Paiement à régulariser","Payment action required"],
  ENDED:["Souscription terminée","Subscription ended"],REFUNDED:["Paiement remboursé","Payment refunded"],DISPUTED:["Paiement en litige","Payment disputed"],
};
export default function BillingView(){
  const {lang}=useLang(),{profile}=useAccountSession(),query=useSearchParams(),tx=(fr:string,en:string)=>lang==="fr"?fr:en;
  const [snapshot,setSnapshot]=useState<BillingSnapshot|null>(null),[error,setError]=useState<BillingClientError|null>(null);
  const [interval,setInterval]=useState<"MONTH"|"YEAR">("MONTH"),[methods,setMethods]=useState<SignInMethod[]>([]);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[ambiguous,setAmbiguous]=useState(false),[action,setAction]=useState<"checkout"|"portal"|"sync"|null>(null),[copied,setCopied]=useState("");
  const alive=useRef(false),epoch=useRef(0),lock=useRef(false),pending=useRef<AbortController|null>(null);
  useEffect(()=>{
    alive.current=true;const controller=new AbortController();
    queueMicrotask(()=>{
      if(controller.signal.aborted)return;
      if(!profile?.verified){setLoading(false);return;}
      void Promise.all([billingRead(controller.signal),accountFetch<SignInMethod[]>("methods","GET",undefined,controller.signal)]).then(([data,list])=>{
        if(alive.current&&!controller.signal.aborted){setSnapshot(data);setMethods(list);if(data.interval)setInterval(data.interval);setError(null);}
      }).catch(e=>{if(alive.current&&!controller.signal.aborted)setError(e instanceof BillingClientError?e:new BillingClientError("billing_unavailable"));})
        .finally(()=>{if(alive.current&&!controller.signal.aborted)setLoading(false);});
    });
    const hide=()=>{if(document.visibilityState==="hidden"){epoch.current++;pending.current?.abort();}};
    const leave=()=>{epoch.current++;pending.current?.abort();};
    document.addEventListener("visibilitychange",hide);window.addEventListener("pagehide",leave);
    return()=>{alive.current=false;controller.abort();leave();document.removeEventListener("visibilitychange",hide);window.removeEventListener("pagehide",leave);};
  },[profile?.verified]);
  async function refresh(){
    if(lock.current)return;lock.current=true;setBusy(true);const controller=new AbortController();pending.current=controller;
    try{const [data,list]=await Promise.all([billingRead(controller.signal),accountFetch<SignInMethod[]>("methods","GET",undefined,controller.signal)]);if(alive.current&&!controller.signal.aborted){setSnapshot(data);setMethods(list);setError(null);setAmbiguous(false);if(data.interval)setInterval(data.interval);}}
    catch(e){if(alive.current&&!controller.signal.aborted){setSnapshot(null);setError(e instanceof BillingClientError?e:new BillingClientError("billing_unavailable"));}}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  async function perform(kind:"checkout"|"portal"|"sync"){
    if(lock.current)return;lock.current=true;setBusy(true);setError(null);setCopied("");const revision=++epoch.current,controller=new AbortController();pending.current=controller;let identityRequired=false;
    try{
      if(kind==="sync"){const data=await billingSync(controller.signal);if(alive.current&&epoch.current===revision&&!controller.signal.aborted){setSnapshot(data);setAmbiguous(false);}}
      else{const url=await billingDestination(kind,interval,controller.signal);
        if(alive.current&&epoch.current===revision&&!controller.signal.aborted&&document.visibilityState==="visible")window.location.assign(url);}
    }catch(e){if(e instanceof BillingClientError&&e.code==="reauth_required"){identityRequired=true;throw new AccountClientError("reauth_required",403);}
      if(alive.current){setSnapshot(null);setAmbiguous(true);setError(e instanceof BillingClientError?e:new BillingClientError("billing_unavailable"));}}
    finally{lock.current=false;if(alive.current){if(!identityRequired)setAction(null);setBusy(false);}}
  }
  async function diagnostic(){
    try{await navigator.clipboard.writeText(JSON.stringify({schemaVersion:1,code:error?.code,requestId:error?.requestId,stage:"BILLING"},null,2));setCopied(tx("Diagnostic minimal copié.","Minimal diagnostic copied."));}
    catch{setCopied(tx("Copie indisponible. Conservez le code affiché, sans données de paiement.","Copy unavailable. Keep the displayed code, without payment data."));}
  }
  const price=(v:number|null)=>v===null?tx("Tarif à confirmer","Price to be confirmed"):new Intl.NumberFormat(lang,{style:"currency",currency:"EUR"}).format(v/100);
  const errorText=(code:BillingCode)=>errors[code]?.[lang==="fr"?0:1]??tx("Le service est temporairement indisponible. Actualisez l’état avant toute nouvelle action.","The service is temporarily unavailable. Refresh status before taking another action.");
  const date=(v:string)=>new Intl.DateTimeFormat(lang,{dateStyle:"long",timeStyle:"short",timeZone:"UTC"}).format(new Date(v))+" UTC";
  const pendingCheckout=snapshot&&["CHECKOUT_PENDING","OPEN"].includes(snapshot.phase);
  const confirmReady=!!profile?.verified;
  return <main className={c.page}>
    <PageHeading title={tx("Abonnement Premium","Premium subscription")} description={tx("Votre offre, vos paiements et vos factures, au même endroit.","Your plan, payments and invoices in one place.")}
      action={profile?.verified&&<button type="button" className={c.secondary} disabled={busy||loading} onClick={()=>void refresh()}>{tx("Actualiser l’état","Refresh status")}</button>}/>
    {!profile?.verified?<EmptyState title={tx("Vérifiez votre email","Verify your email")} description={tx("La facturation est réservée aux comptes vérifiés.","Billing is available to verified accounts.")}><Link href="/account/verify">{tx("Vérifier mon email","Verify my email")}</Link></EmptyState>
    :loading?<EmptyState title={tx("Chargement de l’abonnement","Loading subscription")} kind="loading"/>
    :<>
      {query.get("payment")&&["return","cancel"].includes(query.get("payment")!)&&<p className={s.notice} role="status">{tx("Retour de Stripe. La synchronisation serveur confirmera l’état du paiement. Une session Checkout peut rester ouverte après votre retour ; retrouvez l’intention existante.","Returned from Stripe. Server synchronization will confirm payment status. A Checkout session can remain open after your return; recover the existing intention.")}</p>}
      {error&&<section className={s.error} role="alert"><h2>{tx("Action non confirmée","Action not confirmed")}</h2><p>{errorText(error.code)}</p>
        {ambiguous&&<p>{tx("Une réponse perdue ne prouve pas l’échec d’un Checkout. Aucune nouvelle tentative automatique n’est lancée.","A lost response does not prove Checkout failed. No automatic retry is started.")}</p>}
        <p><code>{error.code}</code>{error.requestId&&<> · <code>{error.requestId}</code></>}</p><button type="button" className={c.secondary} onClick={()=>void diagnostic()}>{tx("Copier le diagnostic minimal","Copy minimal diagnostic")}</button>
        <p className={s.hint}>{tx("Conservez ce diagnostic au plus 24 h. N’ajoutez ni carte, identifiant Stripe, cookie ou URL de paiement.","Keep this diagnostic for at most 24 h. Do not add card data, Stripe IDs, cookies or payment URLs.")}</p><span role="status">{copied}</span>
      </section>}
      {!snapshot&&!error&&<EmptyState title={tx("État indisponible","Status unavailable")} kind="error"/>}
      {snapshot&&<>
        {!snapshot.paymentsEnabled&&<section className={s.notice} aria-labelledby="billing-disabled"><h2 id="billing-disabled">{tx("Paiements désactivés","Payments disabled")}</h2><p>{tx("Les tarifs et la recette restent à valider. Aucune souscription payante n’est proposée pour le moment.","Pricing and acceptance are awaiting approval. Paid subscriptions are currently unavailable.")}</p></section>}
        {!snapshot.ciEnabled&&<p className={s.ciClosed}>{tx("L’accès CI Premium reste désactivé jusqu’à la recette complète.","Premium CI access remains disabled until full acceptance.")}</p>}
        <section className={s.state}><div><h2>{tx("Votre souscription","Your subscription")}</h2><StatusBadge tone={snapshot.status==="ACTIVE"?"success":["PAYMENT_REQUIRED","REFUNDED","DISPUTED"].includes(snapshot.status)?"warning":"neutral"}>{statuses[snapshot.status][lang==="fr"?0:1]}</StatusBadge>
          {snapshot.periodEnd&&<p>{snapshot.status==="CANCEL_AT_PERIOD_END"?tx("Fin d’accès payée : ","Paid access ends: "):tx("Fin de période confirmée : ","Confirmed period end: ")}{date(snapshot.periodEnd)}</p>}
          {snapshot.lastSyncedAt&&<p className={s.hint}>{tx("Dernière vérification Stripe : ","Last Stripe verification: ")}{date(snapshot.lastSyncedAt)}</p>}
          {snapshot.sync==="DEFERRED"&&<p className={s.warning}>{tx("Synchronisation différée. Le dernier état confirmé est affiché ; les nouveaux accès exigent une vérification récente.","Synchronization delayed. The last confirmed state is shown; new access requires recent verification.")}</p>}
          {snapshot.diagnostic&&<p>{(errors[snapshot.diagnostic]??errors.billing_sync_pending!)[lang==="fr"?0:1]}</p>}
        </div><div className={s.actions}><button className={c.secondary} disabled={busy||ambiguous||!snapshot.portalAvailable||!confirmReady} onClick={()=>setAction("portal")}>{tx("Factures et gestion dans Stripe","Invoices and management in Stripe")}</button>
          <button className={c.secondary} disabled={busy||ambiguous||!snapshot.enabled||!snapshot.portalAvailable||!confirmReady} onClick={()=>setAction("sync")}>{tx("Vérifier depuis Stripe","Check with Stripe")}</button>
          <p className={s.hint}>{tx("Le portail sécurisé permet de consulter les factures, mettre à jour le moyen de paiement et annuler en fin de période.","The secure portal lets you view invoices, update payment methods and cancel at period end.")}</p></div></section>
        <section className={s.pricing} aria-labelledby="premium-price"><h2 id="premium-price">{tx("Premium · EUR","Premium · EUR")}</h2>
          <fieldset disabled={busy||!!pendingCheckout}><legend>{tx("Choisir la périodicité","Choose billing interval")}</legend><div className={s.plans}>{snapshot.plans.map(p=><label key={p.interval} className={s.plan} data-selected={interval===p.interval}>
            <span className={s.choice}><input type="radio" name="billing-interval" value={p.interval} checked={interval===p.interval} onChange={()=>setInterval(p.interval)}/>{p.interval==="MONTH"?tx("Mensuel","Monthly"):tx("Annuel","Annual")}</span>
            <strong>{price(p.amountHtCents)}</strong><span>{p.interval==="MONTH"?tx("HT par mois","excluding tax per month"):tx("HT par an","excluding tax per year")}</span>
            {p.interval==="YEAR"&&<small>{p.amountHtCents===null?tx("Réduction annuelle à confirmer.","Annual discount to be confirmed."):tx("Réduction incluse dans le tarif annuel approuvé.","Discount included in the approved annual price.")}</small>}
          </label>)}</div></fieldset>
          <p className={s.tax}>{tx("Prix principal HT. Le montant TTC est calculé et affiché par Stripe avant paiement selon votre situation fiscale ; aucun taux n’est présumé ici.","Main price excludes tax. Stripe calculates and displays the tax-inclusive total before payment according to your tax situation; no tax rate is assumed here.")}</p>
          <div className={s.actions}><button className={c.primary} disabled={busy||ambiguous||!snapshot.canCheckout||!confirmReady} onClick={()=>setAction("checkout")}>{pendingCheckout?tx("Retrouver le Checkout en cours","Recover pending Checkout"):tx("Continuer avec Stripe Checkout","Continue with Stripe Checkout")}</button><p className={s.hint}>{tx("Une confirmation de votre identité précède l’ouverture de Stripe. Les coordonnées de carte restent chez Stripe.","Confirm your identity before opening Stripe. Card details stay with Stripe.")}</p></div>
          {pendingCheckout&&<p>{tx("La périodicité est liée à l’intention en cours. Toute reprise retrouve la même session.","The interval is bound to the pending intention. Recovery returns the same session.")}</p>}
          {!confirmReady&&<p>{tx("Reconnectez-vous récemment ou ajoutez un moyen de confirmation depuis la sécurité du compte.","Sign in again recently or add a confirmation method in account security.")} <Link href="/account/settings?section=security">{tx("Sécurité du compte","Account security")}</Link></p>}
        </section>
        <section className={s.details}><h2>{tx("Ce que comprend Premium CI","What Premium CI includes")}</h2><ul><li>{tx("3 clés incluses, 30 analyses par mois pour chaque intégration stable.","3 included keys, 30 analyses per month for each stable integration.")}</li><li>{tx("Domaines vérifiés illimités, un audit simultané par compte, clé valable un an au maximum.","Unlimited verified domains, one concurrent audit per account, keys valid for at most one year.")}</li><li>{tx("Deux mesures confirmées réservent deux analyses. La rotation ou un nouvel abonnement ne remet pas les compteurs à zéro.","Two confirmation samples reserve two analyses. Rotation or a new subscription does not reset counters.")}</li></ul>
          <p>{tx("L’annulation en fin de période conserve les accès jusqu’à l’échéance payée, sous réserve d’un paiement confirmé. Impayé, remboursement ou litige suspendent les nouveaux accès selon la politique de lancement à valider. Les audits déjà admis et les rapports existants sont conservés.","Period-end cancellation retains access until the paid expiry, subject to confirmed payment. Unpaid, refunded or disputed payments suspend new access under the launch policy awaiting approval. Already admitted audits and existing reports are preserved.")}</p>
          <Link href="/docs/usage">{tx("Comprendre les quotas et la conservation","Understand quotas and retention")}</Link>
        </section>
      </>}
    </>}
    {action&&<ConfirmAccountAction title={action==="checkout"?tx("Ouvrir le paiement sécurisé","Open secure checkout"):action==="portal"?tx("Ouvrir la gestion Stripe","Open Stripe management"):tx("Vérifier la souscription","Check subscription")}
      description={tx("Confirmez votre identité avant de continuer. Une reprise de paiement retrouve le Checkout déjà associé à votre compte.","Confirm your identity before continuing. Payment recovery returns to the Checkout already linked to your account.")}
      recentSessionHint={tx("Cette action nécessite une connexion récente. Si votre session est trop ancienne, reconnectez-vous avec votre fournisseur avant de confirmer.","This action requires a recent sign-in. If your session is too old, sign in again with your provider before confirming.")}
      allowRecentSession returnTo="/account/billing" hasPassword={methods.some(m=>m.provider==="password"&&m.usable)} hasEmail={!!profile?.email} onCancel={()=>setAction(null)} onConfirm={()=>perform(action)}/>}
  </main>;
}
