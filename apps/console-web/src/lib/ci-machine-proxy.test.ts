import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { ciMachineProxy } from "./ci-machine-proxy";
import { boundedJson } from "./bounded-request";
const id="a2942a5c-b63a-45cd-a88a-d02b1af5db02",secret="argos_ci_"+"1".repeat(32)+"."+"x".repeat(43);
const now="2026-10-18T12:00:00Z";
const run={id:"9001",sample:1,status:"QUEUED",createdAt:now,startedAt:null,finishedAt:null,failureCode:null};
const admission={apiVersion:1,id,profileId:"standard-v1",samples:1,createdAt:now,runs:[run]};
const identity={apiVersion:1,integrationId:id,keyId:"1".repeat(32),scopes:["audits:write","results:read","usage:read"],origins:["https://example.com"]};
function req(path="v1/analyses",method="POST",body:unknown={url:"https://example.com",profileId:"standard-v1",samples:1},auth="Bearer "+secret) {
  return new NextRequest("https://argos.example.com/api/ci/"+path,{method,headers:{Authorization:auth,"Content-Type":"application/json","Idempotency-Key":id,
    Cookie:"argos_account=browser; ADMIN_TOKEN=private","X-Forwarded-For":"127.0.0.1","X-Argos-Measurement":"analytics","X-Owner-Id":"99"},
    ...(method==="POST"?{body:JSON.stringify(body)}:{})});
}
const call=(request:NextRequest)=>ciMachineProxy(request,request.nextUrl.pathname.slice("/api/ci/".length).split("/"));
describe("CI machine BFF",()=>{
  beforeEach(()=>{vi.stubEnv("API_BASE","http://java:8081");vi.stubGlobal("fetch",vi.fn());});
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it("requires a machine bearer even on unknown paths; cookies cannot substitute",async()=>{
    for(const auth of ["","Bearer browser","Basic admin"])for(const path of ["v1/analyses","v2/unknown"]) {
      const response=await call(req(path,"POST",{},auth));expect(response.status).toBe(401);expect((await response.json()).error.code).toBe("AUTHENTICATION_FAILED");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects injected ownership, profile bypass, private/credential/query URLs and ambiguous headers",async()=>{
    for(const body of [{url:"https://example.com",profileId:"standard-v1",samples:1,owner:99},
      {url:"https://127.0.0.1",profileId:"standard-v1",samples:1},{url:"https://example.com?a=secret",profileId:"standard-v1",samples:1},
      {url:"https://example.com#secret",profileId:"standard-v1",samples:1},{url:"https://user:pass@example.com",profileId:"standard-v1",samples:1},
      {url:"https://example.com",profileId:"disable-security",samples:1},{url:"https://example.com",profileId:"standard-v1",samples:1.5}])
      expect((await call(req("v1/analyses","POST",body))).status).toBe(400);
    expect((await call(req("v1/usage?owner=99","GET"))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("forwards only machine authentication and the original intention",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(admission,{status:201}));
    const response=await call(req());expect(response.status).toBe(201);expect(response.headers.get("cache-control")).toBe("private, no-store");
    const [url,options]=vi.mocked(fetch).mock.calls[0];expect(url).toBe("http://java:8081/api/ci/v1/analyses");
    const headers=options?.headers as Headers;
    expect([...headers.keys()].sort()).toEqual(["accept","authorization","content-type","idempotency-key"]);
    expect(headers.get("Idempotency-Key")).toBe(id);expect(headers.get("Authorization")).toBe("Bearer "+secret);
    expect(options?.cache).toBe("no-store");expect(options?.redirect).toBe("error");
  });
  it("authenticates unknown routes using a fixed read-only probe",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(identity));
    expect((await call(req("v2/unknown","GET"))).status).toBe(404);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("http://java:8081/api/ci/v1/identity");
  });
  it("filters arbitrary upstream errors, unknown fields, wrong objects and oversized payloads",async()=>{
    for(const upstream of [Response.json({error:"synthetic-private-value"},{status:500}),Response.json({...run,claim:"synthetic-private-value"}),
      Response.json({...run,id:"9002"}),new Response("<html>synthetic-private-value</html>",{status:502,headers:{"Content-Type":"text/html"}}),
      Response.json({data:"synthetic-private-value".repeat(6000)})]) {
      vi.mocked(fetch).mockResolvedValueOnce(upstream);const response=await call(req("v1/runs/9001","GET"));
      expect(response.status).toBe(502);expect(await response.text()).not.toContain("synthetic-private-value");
    }
  });
  it("returns a numeric report with explicit null measurements and no raw evidence",async()=>{
    const report={apiVersion:1,kind:"summary-v1",runId:"9001",globalScore:null,scoringVersion:null,criticalCount:null,importantCount:null,
      completeness:"UNKNOWN",generatedAt:now,expiresAt:null};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(report));const response=await call(req("v1/runs/9001/report","GET"));
    expect(response.status).toBe(200);expect(await response.json()).toEqual(report);
  });
  it("bounds request bytes and cancels a body whose deadline expires",async()=>{
    expect((await call(req("v1/analyses","POST",{url:"https://example.com/"+"x".repeat(9000),profileId:"standard-v1",samples:1}))).status).toBe(400);
    const controller=new AbortController();let canceled=false;
    const body=new ReadableStream<Uint8Array<ArrayBuffer>>({pull(){},cancel(){canceled=true;}});
    const reading=boundedJson({headers:new Headers(),body},8192,controller.signal);controller.abort();
    await expect(reading).rejects.toThrow();expect(canceled).toBe(true);
  });
});
