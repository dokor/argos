import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { accountProxy } from "./account-proxy";
import catalog from "./ci-error-catalog.json";
import { ciUpstreamError } from "./ci-management-proxy";
const origin="https://argos.example.com", id="49e4eac3-00a9-4de4-81dc-f4686fb677cc", csrf="c".repeat(43);
const target={id,origin:"https://example.com",method:"HTTPS_FILE",state:"PENDING",verifiedAt:null,validUntil:null,
  nextCheckAt:"2026-10-18T12:00:00Z",challengeExpiresAt:"2026-10-19T12:00:00Z"};
const key={id:"1".repeat(32),integrationId:id,slot:1,name:"Deployment",scopes:["results:read"],targets:[{id,origin:"https://example.com",authorizationEpoch:1}],
  createdAt:"2026-10-18T12:00:00Z",expiresAt:"2027-10-18T12:00:00Z",lastUsedAt:null,revokedAt:null,overlapUntil:null};
function request(path="targets",method="GET",body?:object,authenticated=true) {
  return new NextRequest(origin+"/api/account/ci/"+path,{method,headers:{Origin:origin,"Content-Type":"application/json",
    "X-Argos-CSRF":csrf,...(authenticated?{Cookie:`argos_account=browser-session; argos_account_csrf=${csrf}`}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
}
const call=(req:NextRequest)=>accountProxy(req,req.nextUrl.pathname.slice("/api/account/".length).split("/"));
describe("CI management BFF",()=>{
  beforeEach(()=>{vi.stubEnv("ACCOUNT_ORIGIN",origin);vi.stubEnv("API_BASE","http://java:8081");vi.stubGlobal("fetch",vi.fn());});
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it("ships the exact canonical catalog inside the standalone frontend context",()=>{
    expect(catalog).toEqual(JSON.parse(readFileSync(new URL("../../../api-backend/src/main/resources/ci/error-catalog-v1.json",import.meta.url),"utf8")));
  });
  it("requires the browser session and CSRF before any proxy request",async()=>{
    const missing=await call(request("targets","GET",undefined,false));expect(missing.status).toBe(401);
    expect((await missing.json()).error.code).toBe("AUTHENTICATION_FAILED");
    const denied=await call(request("targets","POST",{origin:"https://example.com"},false));expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("REQUEST_REJECTED");expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects injected owners, private origins, unsupported actions and query ambiguity",async()=>{
    for(const req of [request("targets","POST",{origin:"https://example.com",owner:22}),
      request("targets","POST",{origin:"https://127.0.0.1"}), request("targets?after=0&after=1"),
      request("targets?owner=22"),request(`targets/${id}/change`,"POST",{})]) {
      const response=await call(req);expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("proxies only same-origin browser credentials and validates the one-time challenge shape",async()=>{
    vi.mocked(fetch).mockResolvedValue(Response.json({target,path:`/.well-known/argos-ci/${id}.txt`,content:"argos-ci-v1="+"x".repeat(43)}));
    const result=await call(request("targets","POST",{origin:"https://example.com"}));expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(fetch).toHaveBeenCalledWith("http://java:8081/api/account/ci/targets",expect.objectContaining({redirect:"error",cache:"no-store"}));
    const forwarded=vi.mocked(fetch).mock.calls[0][1]?.headers as Headers;
    expect(forwarded.get("Authorization")).toBe("Bearer browser-session");
    expect(forwarded.get("Origin")).toBe(origin);
  });
  it("never returns raw upstream errors, unknown fields or oversized content",async()=>{
    for(const response of [Response.json({error:"synthetic-secret"},{status:500}),
      new Response("<html>synthetic-secret</html>",{status:500,headers:{"Content-Type":"text/html"}}),
      Response.json({items:[{...target,secret:"synthetic-secret"}],nextCursor:null}),
      Response.json({secret:"synthetic-secret".repeat(40000)})]) {
      vi.mocked(fetch).mockResolvedValueOnce(response);const result=await call(request());const text=await result.text();
      expect(result.status).toBe(502);expect(text).not.toContain("synthetic-secret");
    }
  });
  it("preserves only consistent versioned errors and their safe retry delay",async()=>{
    const entry=catalog.errors.RATE_LIMITED;
    const data={schemaVersion:1,requestId:id,error:{code:"RATE_LIMITED",stage:entry.stage,category:entry.category,
      messageKey:entry.messageKey,actionCode:entry.actionCode,retryable:entry.retryable,recovery:entry.recovery,retryAfterSeconds:60}};
    const result=ciUpstreamError(data,429);expect(result.status).toBe(429);expect(result.headers.get("retry-after")).toBe("60");
    expect(await result.json()).toEqual(data);
    const invalid=ciUpstreamError({...data,error:{...data.error,actionCode:"::error::synthetic-secret"}},429);
    expect(invalid.status).toBe(502);expect(await invalid.text()).not.toContain("synthetic-secret");
  });
  it("shows the key credential only in a valid creation response and never in lists",async()=>{
    const credential="argos_ci_"+key.id+"."+"A".repeat(43);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({key,credential}));
    const created=await call(request("keys","POST",{name:"Deployment",scopes:["results:read"],targetIds:[id]}));
    expect(created.status).toBe(200);expect((await created.json()).credential).toBe(credential);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({items:[key],integrations:[{id,slot:1,canReplace:false}],nextCursor:null}));
    const listed=await call(request("keys"));expect(listed.status).toBe(200);expect(await listed.text()).not.toContain(credential);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({items:[{...key,credential}],integrations:[],nextCursor:null}));
    const unsafe=await call(request("keys"));expect(unsafe.status).toBe(502);expect(await unsafe.text()).not.toContain(credential);
  });
  it("rejects unapproved scopes, owners, target substitution fields and unbounded expiry forms",async()=>{
    const valid={name:"Deployment",scopes:["results:read"],targetIds:[id]};
    for(const input of [{...valid,scopes:["admin"]},{...valid,ownerUserId:"22"},{...valid,targetIds:[]},
      {...valid,scopes:["results:read","results:read"]},{...valid,name:"Injection\r\n::error::"},{...valid,expiresAt:"never"}]) {
      const response=await call(request("keys","POST",input));expect(response.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not blindly accept a rotation response for a different key identifier",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({key,credential:"argos_ci_"+"2".repeat(32)+"."+"A".repeat(43)}));
    const response=await call(request(`keys/${key.id}/rotate`,"POST",{}));expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("TRANSPORT_FAILED");
  });
  it("returns only the validated owner status and quota snapshot behind the browser session",async()=>{
    const data={enabled:true,eligible:true,offer:"PREMIUM",validUntil:"2026-11-18T12:00:00Z",limits:{monthlyAnalysesPerKey:30,activeKeys:3,verifiedTargets:null,concurrentRuns:1,keyLifetimeYears:1},period:"2026-10",timezone:"UTC",startsAt:"2026-10-01T00:00:00Z",resetsAt:"2026-11-01T00:00:00Z",integrations:[{id,slot:1,used:8,reserved:2}]};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(data));const response=await call(request("status"));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(await response.json()).toEqual(data);
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({...data,enabled:false,eligible:false,limits:null}));expect((await call(request("status"))).status).toBe(200);
    for(const changed of [{...data,credential:"synthetic-secret"},{...data,offer:"FREE"},{...data,validUntil:null},{...data,integrations:[{id,slot:1,used:-1,reserved:0}]},{...data,integrations:[data.integrations[0],data.integrations[0]]}]){
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(changed));const denied=await call(request("status"));expect(denied.status).toBe(502);expect(await denied.text()).not.toContain("synthetic-secret");
    }
    vi.mocked(fetch).mockClear();expect((await call(request("status?after=1"))).status).toBe(400);expect((await call(request("status","GET",undefined,false))).status).toBe(401);expect(fetch).not.toHaveBeenCalled();
  });
});
