import { NextRequest, NextResponse } from "next/server";
import { boundedJson } from "./bounded-request";
import { ciFailure, ciUpstreamError, validCiOrigin } from "./ci-management-proxy";
import { ssrfError } from "./audit-url-validation";
import exportCatalogue from "./ci-export-catalog-v1.json";

const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow, noarchive","Vary":"Authorization"};
const publicIssue={title:"Argos audit: review required",body:"An Argos CI audit requires an authenticated review. Open Argos with your own account. Findings are available only through authenticated access."};
const uuid="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const isUuid=(v:unknown)=>typeof v==="string" && new RegExp(`^${uuid}$`).test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==="object" && !Array.isArray(v);
const exact=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).length===fields.length && fields.every(k=>Object.hasOwn(v,k));
const integer=(v:unknown)=>typeof v==="number" && Number.isSafeInteger(v) && v>=0;
const nullableInteger=(v:unknown)=>v===null || integer(v);
const timestamp=(v:unknown)=>typeof v==="string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(v) && Number.isFinite(Date.parse(v));
const nullableTime=(v:unknown)=>v===null || timestamp(v);
const scopes=["audits:write","results:read","usage:read"];
const scopeList=(v:unknown)=>Array.isArray(v) && v.length>0 && v.length<=3 && new Set(v).size===v.length && v.every(s=>scopes.includes(s));
const runId=(v:unknown)=>typeof v==="string" && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v)<=BigInt("9223372036854775807");
function run(v:unknown):boolean {
  return object(v) && exact(v,["id","sample","status","createdAt","startedAt","finishedAt","failureCode"]) && runId(v.id)
    && [1,2].includes(Number(v.sample)) && typeof v.sample==="number" && ["QUEUED","RUNNING","COMPLETED","FAILED","CANCELED"].includes(String(v.status))
    && timestamp(v.createdAt) && nullableTime(v.startedAt) && nullableTime(v.finishedAt) && v.failureCode===(v.status==="FAILED"?"RUN_FAILED":null);
}
function usage(v:unknown):boolean {
  return object(v) && exact(v,["period","timezone","startsAt","resetsAt","used","reserved","limit","available"])
    && typeof v.period==="string" && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(v.period)
    && typeof v.timezone==="string" && /^[A-Za-z0-9_+/:\-]{1,64}$/.test(v.timezone)
    && timestamp(v.startsAt) && timestamp(v.resetsAt) && [v.used,v.reserved,v.limit,v.available].every(integer)
    && v.available===Math.max(0,Number(v.limit)-Number(v.used)-Number(v.reserved));
}
function details(v:unknown):boolean {
  if(!object(v) || !exact(v,["version","categories","checks","findings","omittedFindings"]) || v.version!==1 || !integer(v.omittedFindings))return false;
  const domains=["performance","security","seo","a11y"];
  if(!Array.isArray(v.categories) || v.categories.length>4 || !v.categories.every(c=>object(c) && exact(c,["key","score"]) && domains.includes(String(c.key))
    && nullableInteger(c.score) && Number(c.score)<=100) || new Set(v.categories.map(c=>c.key)).size!==v.categories.length)return false;
  const catalogue:Record<string,string>=exportCatalogue;
  for(const field of ["checks","findings"] as const) {
    const rows=v[field];if(!Array.isArray(rows) || rows.length>(field==="checks"?256:128))return false;
    if(!rows.every(r=>object(r) && exact(r,field==="checks"?["key","category","state"]:["key","category","severity"])
      && typeof r.key==="string" && Object.hasOwn(catalogue,r.key) && r.category===catalogue[r.key]
      && (field==="checks"?["MEASURED","UNAVAILABLE","BLOCKED_BY_ANTIBOT","NOT_APPLICABLE"].includes(String(r.state)):["critical","important","info"].includes(String(r.severity)))))return false;
    if(new Set(rows.map(r=>r.key)).size!==rows.length)return false;
  }
  return true;
}
function success(path:string,v:unknown):boolean {
  if(!object(v))return false;
  if(path.endsWith("/export"))return exact(v,["apiVersion","kind","summary","reportPath","details","artifactPolicy","publicIssue"]) && v.apiVersion===1 && v.kind==="details-v1"
    && success(path.replace(/export$/,"report"),v.summary) && object(v.summary) && v.reportPath===`/api/ci/v1/runs/${v.summary.runId}/report` && details(v.details)
    && object(v.artifactPolicy) && exact(v.artifactPolicy,["visibility","retentionDays","diagnosticRetentionDays","automaticUpload"])
    && v.artifactPolicy.visibility==="private" && v.artifactPolicy.retentionDays===7 && v.artifactPolicy.diagnosticRetentionDays===1 && v.artifactPolicy.automaticUpload===false
    && object(v.publicIssue) && exact(v.publicIssue,["title","body"]) && v.publicIssue.title===publicIssue.title && v.publicIssue.body===publicIssue.body;
  if(v.deleted===true)return exact(v,["apiVersion","runId","deleted"]) && v.apiVersion===1 && runId(v.runId);
  if(path==="v1/identity")return exact(v,["apiVersion","integrationId","keyId","scopes","origins"]) && v.apiVersion===1
    && isUuid(v.integrationId) && typeof v.keyId==="string" && /^[a-f0-9]{32}$/.test(v.keyId) && scopeList(v.scopes)
    && Array.isArray(v.origins) && v.origins.length>0 && v.origins.length<=100 && v.origins.every(validCiOrigin);
  if(path==="v1/usage")return exact(v,["apiVersion","usage"]) && v.apiVersion===1 && usage(v.usage);
  if(path==="v1/preflight")return exact(v,["apiVersion","newAccessAllowed","scopes","targets","usage"]) && v.apiVersion===1
    && typeof v.newAccessAllowed==="boolean" && scopeList(v.scopes) && usage(v.usage)
    && Array.isArray(v.targets) && v.targets.length>0 && v.targets.length<=100 && v.targets.every(t=>object(t)
      && exact(t,["origin","state","authorizedForKey"]) && validCiOrigin(t.origin) && ["PENDING","VERIFIED","REVOKED","EXPIRED"].includes(String(t.state)) && typeof t.authorizedForKey==="boolean");
  if(path.endsWith("/report"))return exact(v,["apiVersion","kind","runId","globalScore","scoringVersion","criticalCount","importantCount","completeness","generatedAt","expiresAt"])
    && v.apiVersion===1 && v.kind==="summary-v1" && runId(v.runId) && nullableInteger(v.globalScore) && Number(v.globalScore)<=100
    && [v.scoringVersion,v.criticalCount,v.importantCount].every(nullableInteger) && ["FULL","PARTIAL","UNKNOWN"].includes(String(v.completeness))
    && timestamp(v.generatedAt) && nullableTime(v.expiresAt);
  if(path.startsWith("v1/runs/"))return run(v);
  return exact(v,["apiVersion","id","profileId","samples","createdAt","runs"]) && v.apiVersion===1 && isUuid(v.id)
    && v.profileId==="standard-v1" && [1,2].includes(Number(v.samples)) && typeof v.samples==="number" && timestamp(v.createdAt)
    && Array.isArray(v.runs) && v.runs.length===v.samples && v.runs.every(run)
    && v.runs.every((r,i)=>object(r) && r.sample===i+1) && new Set(v.runs.map(r=>(r as Record<string,unknown>).id)).size===v.runs.length;
}
function input(v:unknown):boolean {
  if(!object(v) || !exact(v,["url","samples","profileId"]) || typeof v.url!=="string" || v.url.length>2048
    || v.profileId!=="standard-v1" || ![1,2].includes(Number(v.samples)) || typeof v.samples!=="number" || ssrfError(v.url))return false;
  try {const u=new URL(v.url);return u.protocol==="https:" && !u.username && !u.password && !u.search && !u.hash && !u.port;}
  catch{return false;}
}
/** No session/cookie, CSRF bypass, analytics, forwarded identity or arbitrary upstream response. */
export async function ciMachineProxy(request:NextRequest,parts:string[]):Promise<NextResponse> {
  const authorization=request.headers.get("authorization");
  if(!authorization || !/^Bearer argos_ci_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/.test(authorization))return ciFailure("AUTHENTICATION_FAILED");
  if([...request.nextUrl.searchParams.keys()].length)return ciFailure("CONFIG_INVALID");
  const path=parts.join("/");
  const get=request.method==="GET" && new RegExp(`^v1/(?:identity|usage|preflight|admissions/(?:${uuid}|by-key/${uuid})|runs/[1-9][0-9]{0,18}(?:/report|/export)?)$`).test(path);
  const post=request.method==="POST" && path==="v1/analyses";
  const deletion=request.method==="DELETE" && /^v1\/runs\/[1-9][0-9]{0,18}\/report$/.test(path);
  const unknown=!get && !post && !deletion;
  const forwarded=new Headers({Accept:"application/json","Content-Type":"application/json",Authorization:authorization});
  let body:string|undefined;
  if(post) {
    const key=request.headers.get("idempotency-key");if(!isUuid(key))return ciFailure("CONFIG_INVALID");
    if(request.headers.get("content-encoding") && request.headers.get("content-encoding")!=="identity")return ciFailure("CONFIG_INVALID");
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type")??""))return ciFailure("CONFIG_INVALID");
    try {const data=await boundedJson(request,8192,AbortSignal.timeout(5000));if(!input(data))return ciFailure("CONFIG_INVALID");body=JSON.stringify(data);}
    catch{return ciFailure("CONFIG_INVALID");}
    forwarded.set("Idempotency-Key",key as string);
  }
  try {
    // Unknown paths still authenticate through a fixed read-only endpoint; never proxy arbitrary paths.
    const upstreamPath=unknown?"v1/identity":path;
    const signal=AbortSignal.timeout(15000);
    const response=await fetch((process.env.API_BASE??"http://api-backend:8081")+"/api/ci/"+upstreamPath,
      {method:unknown?"GET":request.method,headers:forwarded,body,cache:"no-store",redirect:"error",signal});
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(response.headers.get("content-type")??""))return ciFailure("TRANSPORT_FAILED");
    const data=await boundedJson(response,response.ok?65536:4096,signal);
    if(!response.ok)return ciUpstreamError(data,response.status);
    if(!success(upstreamPath,data) || ![200,...(post?[201]:[])].includes(response.status))return ciFailure("TRANSPORT_FAILED");
    if(unknown)return ciFailure("RESOURCE_NOT_AVAILABLE");
    if(deletion && (!object(data) || data.deleted!==true) || !deletion && object(data) && data.deleted===true)return ciFailure("TRANSPORT_FAILED");
    if(object(data) && (path.startsWith("v1/runs/") && (path.endsWith("/export") && object(data.summary)?data.summary.runId:path.endsWith("/report")?data.runId:data.id)!==path.split("/")[2]
      || new RegExp(`^v1/admissions/${uuid}$`).test(path) && data.id!==path.split("/")[2]))return ciFailure("TRANSPORT_FAILED");
    return NextResponse.json(data,{status:response.status,headers:{...headers,...(path.endsWith("/export")?{"Content-Disposition":`attachment; filename="argos-ci-run-${path.split("/")[2]}.json"`}:{})}});
  }catch{return ciFailure("TRANSPORT_FAILED");}
}
