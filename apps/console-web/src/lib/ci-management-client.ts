import { accountAuditHeaders, resetAccountCsrf } from "./account-client";
import { boundedJson } from "./bounded-request";
import catalog from "./ci-error-catalog.json";

export type CiCode=keyof typeof catalog.errors;
export class CiManagementError extends Error {
  constructor(public code:CiCode,public requestId:string|null=null,public retryAfterSeconds:number|null=null){super(code);}
}
export type CiTarget={id:string;origin:string;method:"HTTPS_FILE";state:"PENDING"|"VERIFIED"|"REVOKED"|"EXPIRED";verifiedAt:string|null;validUntil:string|null;nextCheckAt:string|null;challengeExpiresAt:string|null};
export type CiKey={id:string;integrationId:string;slot:number;name:string;scopes:string[];targets:{id:string;origin:string;authorizationEpoch:number}[];createdAt:string;expiresAt:string;lastUsedAt:string|null;revokedAt:string|null;overlapUntil:string|null};
export type CiKeys={items:CiKey[];integrations:{id:string;slot:number;canReplace:boolean}[];nextCursor:string|null};
export type CiStatus={enabled:boolean;eligible:boolean;offer:string;validUntil:string|null;limits:{monthlyAnalysesPerKey:number;activeKeys:number;verifiedTargets:number|null;concurrentRuns:number;keyLifetimeYears:number}|null;period:string;timezone:string;startsAt:string;resetsAt:string;integrations:{id:string;slot:number;used:number;reserved:number}[]};
export type CiChallenge={target:CiTarget;path:string;content:string};
export type CiIssued={key:CiKey;credential:string};
/** Same-origin management only. A machine credential is never accepted as input. */
export async function ciManagement<T>(path:string,method="GET",body?:unknown,signal?:AbortSignal):Promise<T> {
  try {
    const deadline=signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000);
    const headers={"Content-Type":"application/json",...(method==="GET"?{}:await accountAuditHeaders(deadline))};
    const response=await fetch("/api/account/ci/"+path,{method,headers,cache:"no-store",redirect:"error",signal:deadline,...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(response.status===401&&typeof window!=="undefined")window.dispatchEvent(new Event("argos-account-invalid"));
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type")??""))throw new CiManagementError("TRANSPORT_FAILED");
    const data=await boundedJson(response,response.ok?262144:4096,deadline) as Record<string,unknown>;
    if(!response.ok){
      const e=data?.error as Record<string,unknown>|undefined;
      if(data?.schemaVersion!==1||!e||typeof e.code!=="string"||!Object.hasOwn(catalog.errors,e.code))throw new CiManagementError("TRANSPORT_FAILED");
      const code=e.code as CiCode,entry=catalog.errors[code];
      if(entry.httpStatus!==response.status||!(["stage","category","messageKey","actionCode","retryable","recovery"] as const).every(k=>entry[k]===e[k]))throw new CiManagementError("TRANSPORT_FAILED");
      if(code==="REQUEST_REJECTED")resetAccountCsrf();
      throw new CiManagementError(code,typeof data.requestId==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(data.requestId)?data.requestId:null,
        typeof e.retryAfterSeconds==="number"&&Number.isSafeInteger(e.retryAfterSeconds)&&e.retryAfterSeconds>0&&e.retryAfterSeconds<=2764800?e.retryAfterSeconds:null);
    }
    return data as T;
  }catch(error){if(error instanceof CiManagementError)throw error;throw new CiManagementError("TRANSPORT_FAILED");}
}
export function ciKeyState(key:CiKey,now=Date.now()):"active"|"overlap"|"expired"|"revoked" {
  return key.revokedAt?"revoked":Date.parse(key.expiresAt)<=now||key.overlapUntil!==null&&Date.parse(key.overlapUntil)<=now?"expired":key.overlapUntil?"overlap":"active";
}
