import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ciBackendOrigin } from "./ci-backend-origin";
import catalog from "./ci-error-catalog.json";
import { boundedJson } from "./bounded-request";
import { ssrfError } from "./audit-url-validation";

type Code = keyof typeof catalog.errors;
const errors = catalog.errors;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive", "Vary": "Authorization" };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const time = (v: unknown) => v === null || typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v) && Number.isFinite(Date.parse(v));
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const exact = (v: Record<string, unknown>, fields: string[]) => Object.keys(v).length === fields.length && fields.every(k=>Object.hasOwn(v,k));
export function ciFailure(code: Code): NextResponse {
  const { httpStatus, stage, category, messageKey, actionCode, retryable, recovery } = errors[code];
  return NextResponse.json({ schemaVersion: 1, requestId: randomUUID(), error: {
    code, stage, category, messageKey, actionCode, retryable, recovery, retryAfterSeconds: null,
  } }, { status: httpStatus, headers });
}
export function ciUpstreamError(data: unknown,status: number): NextResponse {
  if(!object(data) || !exact(data,["schemaVersion","requestId","error"]) || data.schemaVersion!==1
    || typeof data.requestId!=="string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(data.requestId)
    || !object(data.error)) return ciFailure("TRANSPORT_FAILED");
  const e=data.error;
  if(!exact(e,["code","stage","category","messageKey","actionCode","retryable","recovery","retryAfterSeconds"])
    || typeof e.code!=="string" || !Object.hasOwn(errors,e.code)) return ciFailure("TRANSPORT_FAILED");
  const code=e.code as Code, entry=errors[code];
  if(entry.httpStatus!==status || !(["stage","category","messageKey","actionCode","retryable","recovery"] as const)
    .every(key=>e[key]===entry[key])) return ciFailure("TRANSPORT_FAILED");
  const delay=e.retryAfterSeconds;
  if(delay!==null && (!["QUOTA_EXCEEDED","RATE_LIMITED","CAPACITY_UNAVAILABLE","UPSTREAM_UNAVAILABLE","PUBLICATION_RATE_LIMITED"].includes(code)
    || typeof delay!=="number" || !Number.isSafeInteger(delay) || delay<1 || delay>2764800)) return ciFailure("TRANSPORT_FAILED");
  // Reconstruct only protocol fields. Never forward arbitrary upstream headers or prose.
  return NextResponse.json({ schemaVersion:1,requestId:data.requestId,error:{code,stage:entry.stage,category:entry.category,
    messageKey:entry.messageKey,actionCode:entry.actionCode,retryable:entry.retryable,recovery:entry.recovery,retryAfterSeconds:delay} },
    {status,headers:{...headers,...(delay!==null?{"Retry-After":String(delay)}:{})}});
}
export function validCiOrigin(value: unknown): value is string {
  if(typeof value!=="string" || value.length>261 || ssrfError(value)) return false;
  try { const u=new URL(value); return u.protocol==="https:" && (value===u.origin || value===u.origin+"/") && !u.username && !u.password; }
  catch { return false; }
}
function target(v: unknown): boolean {
  return object(v) && exact(v,["id","origin","method","state","verifiedAt","validUntil","nextCheckAt","challengeExpiresAt"])
    && typeof v.id==="string" && uuid.test(v.id) && validCiOrigin(v.origin) && v.method==="HTTPS_FILE"
    && ["PENDING","VERIFIED","REVOKED","EXPIRED"].includes(String(v.state))
    && [v.verifiedAt,v.validUntil,v.nextCheckAt,v.challengeExpiresAt].every(time);
}
const scopes=["audits:write","results:read","usage:read"];
const grant=(v:unknown)=>object(v) && exact(v,["id","origin","authorizationEpoch"]) && typeof v.id==="string" && uuid.test(v.id)
  && validCiOrigin(v.origin) && typeof v.authorizationEpoch==="number" && Number.isSafeInteger(v.authorizationEpoch) && v.authorizationEpoch>0;
function key(v: unknown): boolean {
  return object(v) && exact(v,["id","integrationId","slot","name","scopes","targets","createdAt","expiresAt","lastUsedAt","revokedAt","overlapUntil"])
    && typeof v.id==="string" && /^[a-f0-9]{32}$/.test(v.id) && typeof v.integrationId==="string" && uuid.test(v.integrationId)
    && typeof v.slot==="number" && Number.isSafeInteger(v.slot) && v.slot>0
    && typeof v.name==="string" && v.name.trim().length>0 && v.name.length<=80 && !/[\x00-\x1f\x7f]/.test(v.name)
    && Array.isArray(v.scopes) && v.scopes.length>0 && v.scopes.length<=3 && new Set(v.scopes).size===v.scopes.length && v.scopes.every(s=>scopes.includes(s))
    && Array.isArray(v.targets) && v.targets.length>0 && v.targets.length<=100 && v.targets.every(grant)
    && [v.createdAt,v.expiresAt,v.lastUsedAt,v.revokedAt,v.overlapUntil].every(time) && v.createdAt!==null && v.expiresAt!==null;
}
function keyInput(v: Record<string,unknown>): boolean {
  return Object.keys(v).every(k=>["name","scopes","targetIds","integrationId","expiresAt"].includes(k))
    && typeof v.name==="string" && v.name.trim().length>0 && v.name.length<=80 && !/[\x00-\x1f\x7f]/.test(v.name)
    && Array.isArray(v.scopes) && v.scopes.length>0 && v.scopes.length<=3 && new Set(v.scopes).size===v.scopes.length && v.scopes.every(s=>typeof s==="string" && scopes.includes(s))
    && Array.isArray(v.targetIds) && v.targetIds.length>0 && v.targetIds.length<=100 && new Set(v.targetIds).size===v.targetIds.length && v.targetIds.every(t=>typeof t==="string" && uuid.test(t))
    && (v.integrationId===undefined || v.integrationId===null || typeof v.integrationId==="string" && uuid.test(v.integrationId))
    && (v.expiresAt===undefined || time(v.expiresAt));
}
function keySuccess(data:Record<string,unknown>,method:string): boolean {
  if(method==="GET") return exact(data,["items","integrations","nextCursor"]) && Array.isArray(data.items) && data.items.length<=5 && data.items.every(key)
    && Array.isArray(data.integrations) && data.integrations.length<=100 && data.integrations.every(v=>object(v) && exact(v,["id","slot","canReplace"])
      && typeof v.id==="string" && uuid.test(v.id) && typeof v.slot==="number" && Number.isSafeInteger(v.slot) && v.slot>0 && typeof v.canReplace==="boolean")
    && (data.nextCursor===null || typeof data.nextCursor==="string" && /^[1-9][0-9]{0,18}$/.test(data.nextCursor));
  if(method==="POST") return exact(data,["key","credential"]) && key(data.key) && object(data.key) && typeof data.credential==="string"
    && new RegExp(`^argos_ci_${data.key.id}\\.[A-Za-z0-9_-]{43}$`).test(data.credential);
  return key(data);
}
function success(data: unknown,method: string,path: string): boolean {
  if(!object(data)) return false;
  if(path.startsWith("keys")) return keySuccess(data,method);
  if(method==="GET") return exact(data,["items","nextCursor"]) && Array.isArray(data.items) && data.items.length<=100
    && data.items.every(target) && (data.nextCursor===null || typeof data.nextCursor==="string" && /^[1-9][0-9]{0,18}$/.test(data.nextCursor));
  if(method==="POST" && (path==="targets" || path.endsWith("/renew"))) return exact(data,["target","path","content"])
    && target(data.target) && object(data.target) && data.path===`/.well-known/argos-ci/${data.target.id}.txt`
    && typeof data.content==="string" && /^argos-ci-v1=[A-Za-z0-9_-]{43}$/.test(data.content);
  return target(data);
}
export async function ciManagementProxy(request: NextRequest,parts: string[],getHeaders:()=>Headers|NextResponse): Promise<NextResponse> {
  const path=parts.join("/"), id="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
  const allowed=request.method==="GET" ? ["targets","keys"].includes(path) : request.method==="POST" ? new RegExp(`^(?:targets(?:/${id}/(?:renew|verify))?|keys(?:/[a-f0-9]{32}/rotate)?)$`).test(path)
    : request.method==="DELETE" && new RegExp(`^(?:targets/${id}|keys/[a-f0-9]{32})$`).test(path);
  if(!allowed) return ciFailure("RESOURCE_NOT_AVAILABLE");
  const forwarded=getHeaders();
  if(forwarded instanceof NextResponse) return ciFailure(forwarded.status===401?"AUTHENTICATION_FAILED":"REQUEST_REJECTED");
  if(!forwarded.has("Authorization")) return ciFailure("AUTHENTICATION_FAILED");
  forwarded.delete("X-Argos-Measurement");forwarded.delete("X-Argos-Captcha");
  const params=request.nextUrl.searchParams;
  if([...params.keys()].some(k=>k!=="after" || request.method!=="GET" || params.getAll(k).length!==1)) return ciFailure("CONFIG_INVALID");
  const after=params.get("after");
  if(after!==null && (!/^(0|[1-9][0-9]{0,18})$/.test(after) || BigInt(after)>BigInt("9223372036854775807"))) return ciFailure("CONFIG_INVALID");
  let body: string|undefined;
  if(request.method!=="GET") {
    try {
      const input=request.body ? await boundedJson(request) : {};
      if(!object(input) || (path==="keys" ? !keyInput(input) : path==="targets" ? !exact(input,["origin"]) || !validCiOrigin(input.origin) : Object.keys(input).length!==0))
        return ciFailure("CONFIG_INVALID");
      if(request.method!=="DELETE") body=JSON.stringify(input);
    } catch { return ciFailure("CONFIG_INVALID"); }
  }
  try {
    const upstream=await fetch(ciBackendOrigin()+"/api/account/ci/"+path+(after!==null?"?after="+after:""),
      {method:request.method,headers:forwarded,body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(upstream.headers.get("content-type")??"")) return ciFailure("TRANSPORT_FAILED");
    const data=await boundedJson(upstream,upstream.ok?262144:4096);
    if(!upstream.ok) return ciUpstreamError(data,upstream.status);
    if(!success(data,request.method,path)) return ciFailure("TRANSPORT_FAILED");
    return NextResponse.json(data,{status:upstream.status,headers});
  } catch { return ciFailure("TRANSPORT_FAILED"); }
}
