import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import catalog from "./ci-error-catalog.json";
import { boundedJson } from "./bounded-request";
import { ssrfError } from "./audit-url-validation";

type Code = keyof typeof catalog.errors;
const errors = catalog.errors;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
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
function success(data: unknown,method: string,path: string): boolean {
  if(!object(data)) return false;
  if(method==="GET") return exact(data,["items","nextCursor"]) && Array.isArray(data.items) && data.items.length<=100
    && data.items.every(target) && (data.nextCursor===null || typeof data.nextCursor==="string" && /^[1-9][0-9]{0,18}$/.test(data.nextCursor));
  if(method==="POST" && (path==="targets" || path.endsWith("/renew"))) return exact(data,["target","path","content"])
    && target(data.target) && object(data.target) && data.path===`/.well-known/argos-ci/${data.target.id}.txt`
    && typeof data.content==="string" && /^argos-ci-v1=[A-Za-z0-9_-]{43}$/.test(data.content);
  return target(data);
}
export async function ciManagementProxy(request: NextRequest,parts: string[],getHeaders:()=>Headers|NextResponse): Promise<NextResponse> {
  const path=parts.join("/"), id="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
  const allowed=request.method==="GET" ? path==="targets" : request.method==="POST" ? new RegExp(`^targets(?:/${id}/(?:renew|verify))?$`).test(path)
    : request.method==="DELETE" && new RegExp(`^targets/${id}$`).test(path);
  if(!allowed) return ciFailure("RESOURCE_NOT_AVAILABLE");
  const forwarded=getHeaders();
  if(forwarded instanceof NextResponse) return ciFailure(forwarded.status===401?"AUTHENTICATION_FAILED":"REQUEST_REJECTED");
  if(!forwarded.has("Authorization")) return ciFailure("AUTHENTICATION_FAILED");
  const params=request.nextUrl.searchParams;
  if([...params.keys()].some(k=>k!=="after" || request.method!=="GET" || params.getAll(k).length!==1)) return ciFailure("CONFIG_INVALID");
  const after=params.get("after");
  if(after!==null && (!/^(0|[1-9][0-9]{0,18})$/.test(after) || BigInt(after)>BigInt("9223372036854775807"))) return ciFailure("CONFIG_INVALID");
  let body: string|undefined;
  if(request.method!=="GET") {
    try {
      const input=request.body ? await boundedJson(request) : {};
      if(!object(input) || (path==="targets" ? !exact(input,["origin"]) || !validCiOrigin(input.origin) : Object.keys(input).length!==0))
        return ciFailure("CONFIG_INVALID");
      if(request.method!=="DELETE") body=JSON.stringify(input);
    } catch { return ciFailure("CONFIG_INVALID"); }
  }
  try {
    const upstream=await fetch((process.env.API_BASE??"http://api-backend:8081")+"/api/account/ci/"+path+(after!==null?"?after="+after:""),
      {method:request.method,headers:forwarded,body,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(upstream.headers.get("content-type")??"")) return ciFailure("TRANSPORT_FAILED");
    const data=await boundedJson(upstream,upstream.ok?262144:4096);
    if(!upstream.ok) return ciUpstreamError(data,upstream.status);
    if(!success(data,request.method,path)) return ciFailure("TRANSPORT_FAILED");
    return NextResponse.json(data,{status:upstream.status,headers});
  } catch { return ciFailure("TRANSPORT_FAILED"); }
}
