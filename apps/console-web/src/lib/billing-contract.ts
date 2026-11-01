export const billingCodes=["billing_disabled","billing_configuration","billing_sync_pending","billing_payment_required","billing_existing_subscription","billing_interval_locked","billing_managed_elsewhere","billing_unavailable","billing_request_invalid","billing_webhook_invalid","session_invalid","email_unverified","csrf_invalid","reauth_required","rate_limited","account_unavailable"] as const;
export type BillingCode=typeof billingCodes[number];
export type BillingSnapshot={schemaVersion:1;enabled:boolean;paymentsEnabled:boolean;ciEnabled:boolean;offer:string;
  status:"NONE"|"ACTIVE"|"CANCEL_AT_PERIOD_END"|"PAYMENT_REQUIRED"|"ENDED"|"REFUNDED"|"DISPUTED";
  phase:"NONE"|"CUSTOMER_PENDING"|"CHECKOUT_PENDING"|"OPEN"|"COMPLETE"|"EXPIRED";sync:"NEVER"|"PENDING"|"CURRENT"|"DEFERRED";
  interval:"MONTH"|"YEAR"|null;periodEnd:string|null;lastSyncedAt:string|null;diagnostic:BillingCode|null;
  canCheckout:boolean;portalAvailable:boolean;plans:{interval:"MONTH"|"YEAR";currency:"EUR";amountHtCents:number|null}[]};
export const billingFields=["schemaVersion","enabled","paymentsEnabled","ciEnabled","offer","status","phase","sync","interval","periodEnd","lastSyncedAt","diagnostic","canCheckout","portalAvailable","plans"];
export const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
export const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const time=(v:unknown)=>v===null||typeof v==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v)&&Number.isFinite(Date.parse(v));
export function billingSnapshot(v:unknown):v is BillingSnapshot{
  if(!record(v)||!exact(v,billingFields)||v.schemaVersion!==1
    ||!["enabled","paymentsEnabled","ciEnabled","canCheckout","portalAvailable"].every(k=>typeof v[k]==="boolean")
    ||!["FREE","STANDARD","PREMIUM","CI"].includes(String(v.offer))
    ||!["NONE","ACTIVE","CANCEL_AT_PERIOD_END","PAYMENT_REQUIRED","ENDED","REFUNDED","DISPUTED"].includes(String(v.status))
    ||!["NONE","CUSTOMER_PENDING","CHECKOUT_PENDING","OPEN","COMPLETE","EXPIRED"].includes(String(v.phase))
    ||!["NEVER","PENDING","CURRENT","DEFERRED"].includes(String(v.sync))
    ||!["MONTH","YEAR",null].includes(v.interval as "MONTH"|"YEAR"|null)||!time(v.periodEnd)||!time(v.lastSyncedAt)
    ||v.diagnostic!==null&&!billingCodes.includes(v.diagnostic as BillingCode)||!Array.isArray(v.plans)||v.plans.length!==2)return false;
  for(const [i,p]of v.plans.entries())if(!record(p)||!exact(p,["interval","currency","amountHtCents"])||p.interval!==["MONTH","YEAR"][i]||p.currency!=="EUR"
    ||p.amountHtCents!==null&&(!Number.isSafeInteger(p.amountHtCents)||Number(p.amountHtCents)<1||Number(p.amountHtCents)>1_200_000_000))return false;
  if(!v.enabled&&(v.paymentsEnabled||v.canCheckout||v.portalAvailable)||!v.paymentsEnabled&&v.canCheckout)return false;
  const [m,y]=v.plans.map(p=>p.amountHtCents);
  if(v.paymentsEnabled&&m===null)return false;
  return (m===null)===(y===null)&&(m===null||typeof m==="number"&&typeof y==="number"&&y<m*12);
}
/** Hosted URLs are private; validate all three boundaries, never record them in logs or storage. */
export function stripeDestination(v:unknown,portal:boolean):v is {url:string}{
  if(!record(v)||!exact(v,["url"])||typeof v.url!=="string"||v.url.length>4096)return false;
  try{const u=new URL(v.url);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&u.hostname===(portal?"billing.stripe.com":"checkout.stripe.com")
    &&(portal?u.pathname==="/p/session"||u.pathname.startsWith("/p/session/"):u.pathname.startsWith("/c/pay/"));}catch{return false;}
}
