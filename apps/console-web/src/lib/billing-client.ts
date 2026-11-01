import {accountAuditHeaders,resetAccountCsrf,AccountClientError} from "./account-client";
import {boundedJson} from "./bounded-request";
import {billingCodes,billingSnapshot,stripeDestination,record,type BillingCode,type BillingSnapshot} from "./billing-contract";
export class BillingClientError extends Error {constructor(public code:BillingCode,public requestId:string|null=null){super(code);}}
async function request(path:string,signal:AbortSignal,body?:unknown):Promise<unknown>{
  const bounded=AbortSignal.any([signal,AbortSignal.timeout(40000)]);
  try{
    const response=await fetch("/api/account/billing"+path,{method:body===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",redirect:"error",
      signal:bounded,headers:{"Content-Type":"application/json","Accept-Language":typeof window!=="undefined"&&window.location.pathname.startsWith("/en/")?"en":"fr",
        ...(body===undefined?{}:await accountAuditHeaders(bounded))},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await boundedJson(response,32768,bounded);
    if(!response.ok){
      const code=record(data)&&billingCodes.includes(data.error as BillingCode)?data.error as BillingCode:"billing_unavailable";
      if(code==="csrf_invalid")resetAccountCsrf();
      if(response.status===401)window.dispatchEvent(new Event("argos-account-invalid"));
      throw new BillingClientError(code,record(data)&&typeof data.requestId==="string"&&/^[a-f0-9-]{36}$/.test(data.requestId)?data.requestId:null);
    }
    return data;
  }catch(e){if(e instanceof BillingClientError)throw e;if(e instanceof AccountClientError&&billingCodes.includes(e.code as BillingCode))throw new BillingClientError(e.code as BillingCode);throw new BillingClientError("billing_unavailable");}
}
export async function billingRead(signal:AbortSignal):Promise<BillingSnapshot>{const data=await request("",signal);if(!billingSnapshot(data))throw new BillingClientError("billing_unavailable");return data;}
export async function billingSync(signal:AbortSignal):Promise<BillingSnapshot>{const data=await request("/sync",signal,{});if(!billingSnapshot(data))throw new BillingClientError("billing_unavailable");return data;}
export async function billingDestination(action:"checkout"|"portal",interval:"MONTH"|"YEAR",signal:AbortSignal):Promise<string>{
  const data=await request("/"+action,signal,action==="checkout"?{interval}:{});if(!stripeDestination(data,action==="portal"))throw new BillingClientError("billing_unavailable");return data.url;
}
