import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { NextRequest } from "next/server";
import { ciMachineProxy } from "./ci-machine-proxy";
import { boundedJson } from "./bounded-request";
import verdictPolicy from "./ci-verdict-policy-v1.json";
const id="a2942a5c-b63a-45cd-a88a-d02b1af5db02",secret="argos_ci_"+"1".repeat(32)+"."+"x".repeat(43);
const now="2026-10-18T12:00:00Z";
const run={id:"9001",sample:1,status:"QUEUED",createdAt:now,startedAt:null,finishedAt:null,failureCode:null};
const admission={apiVersion:1,id,profileId:"standard-v1",samples:1,createdAt:now,runs:[run]};
const identity={apiVersion:1,integrationId:id,keyId:"1".repeat(32),scopes:["audits:write","results:read","usage:read"],origins:["https://example.com"]};
const report={apiVersion:1,kind:"summary-v1",runId:"9001",globalScore:null,scoringVersion:null,criticalCount:null,importantCount:null,completeness:"UNKNOWN",generatedAt:now,expiresAt:null};
const exported={apiVersion:1,kind:"details-v1",summary:report,reportPath:"/api/ci/v1/runs/9001/report",
  details:{version:1,categories:[{key:"security",score:65}],checks:[{key:"http.security.csp",category:"security",state:"MEASURED"}],
    findings:[{key:"http.security.csp",category:"security",severity:"critical"}],omittedFindings:0},
  artifactPolicy:{visibility:"private",retentionDays:7,diagnosticRetentionDays:1,automaticUpload:false},
  publicIssue:{title:"Argos audit: review required",body:"An Argos CI audit requires an authenticated review. Open Argos with your own account. Findings are available only through authenticated access."}};
function req(path="v1/analyses",method="POST",body:unknown={url:"https://example.com",profileId:"standard-v1",samples:1},auth="Bearer "+secret) {
  return new NextRequest("https://argos.example.com/api/ci/"+path,{method,headers:{Authorization:auth,"Content-Type":"application/json","Idempotency-Key":id,
    Cookie:"argos_account=browser; ADMIN_TOKEN=private","X-Forwarded-For":"127.0.0.1","X-Argos-Measurement":"analytics","X-Owner-Id":"99"},
    ...(method==="POST"?{body:JSON.stringify(body)}:{})});
}
const call=(request:NextRequest)=>ciMachineProxy(request,request.nextUrl.pathname.slice("/api/ci/".length).split("/"));
describe("CI machine BFF",()=>{
  beforeEach(()=>{vi.stubEnv("API_BASE","http://java:8081");vi.stubGlobal("fetch",vi.fn());});
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it("returns the frozen policy and an owned verdict while rejecting foreign IDs, prose and inconsistent success",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(verdictPolicy));
    expect((await call(req("v1/policies/standard-v1","GET"))).status).toBe(200);
    const verdict={apiVersion:1,kind:"verdict-v1",admissionId:id,policyId:verdictPolicy.policyId,policyFingerprint:verdictPolicy.fingerprint,
      sampleCount:2,outcome:"GO",exitCode:0,error:null,fingerprints:{scoring:"a".repeat(64),measurement:"b".repeat(64),scope:"c".repeat(64),evidence:"e".repeat(64)},confirmedFindings:[]};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(verdict));
    const response=await call(req("v1/admissions/"+id+"/verdict","GET"));expect(response.status).toBe(200);expect(await response.json()).toEqual(verdict);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    for(const data of [{...verdict,admissionId:"b2942a5c-b63a-45cd-a88a-d02b1af5db02"},{...verdict,raw:"synthetic-private-466 ::error::"},
      {...verdict,sampleCount:1},{...verdict,confirmedFindings:[{key:"http.security.csp",category:"security",severity:"critical",ticketEligible:true}]}]) {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(data));const rejected=await call(req("v1/admissions/"+id+"/verdict","GET"));
      expect(rejected.status).toBe(502);expect(await rejected.text()).not.toContain("synthetic-private-466");
    }
  });
  it("requires a machine bearer even on unknown paths; cookies cannot substitute",async()=>{
    for(const auth of ["","Bearer browser","Basic admin"])for(const path of ["v1/analyses","v2/unknown"]) {
      const response=await call(req(path,"POST",{},auth));expect(response.status).toBe(401);expect((await response.json()).error.code).toBe("AUTHENTICATION_FAILED");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects ambiguous backend configuration before sending any credential",async()=>{
    for(const base of ["https://user:synthetic-private-737@backend.example","https://backend.example/path","https://backend.example?q=synthetic-private-737",
      "https://backend.example#fragment","file:///secret","//attacker.example","http://backend.example\\@attacker.example"]) {
      vi.stubEnv("API_BASE",base);
      const response=await call(req("v1/preflight","GET"));expect(response.status).toBe(502);
      expect(await response.text()).not.toContain("synthetic-private-737");
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses forged correlation IDs and injected diagnostic text instead of echoing them",async()=>{
    for(const requestId of ["::error:: @everyone \u001b[31m","https://attacker.example/secret","a".repeat(10000)]) {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json({schemaVersion:1,requestId,error:{code:"INTERNAL_ERROR",raw:"synthetic-private-737"}},{status:500}));
      const response=await call(req("v1/preflight","GET"));expect(response.status).toBe(502);
      const output=await response.text();expect(output).not.toContain("synthetic-private-737");expect(output).not.toContain("everyone");expect(output).not.toContain("attacker.example");
    }
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
  it("returns only the strict private JSON export and sets a controlled attachment filename",async()=>{
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(exported));
    const response=await call(req("v1/runs/9001/export","GET"));
    expect(response.status).toBe(200);expect(await response.json()).toEqual(exported);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="argos-ci-run-9001.json"');
    expect(response.headers.has("set-cookie")).toBe(false);
  });
  it("rejects hostile nested export fields, mentions, workflow commands, fake keys and public ticket text",async()=>{
    const marker="synthetic-private-736 @everyone ::error:: ![image](https://attacker.example) \u001b[31m";
    const variants=[
      {...exported,raw:marker},
      {...exported,details:{...exported.details,findings:[{...exported.details.findings[0],evidence:marker}]}},
      {...exported,details:{...exported.details,checks:[{key:marker,category:"security",state:"MEASURED"}]}},
      {...exported,details:{...exported.details,findings:[{key:"http.security.fake",category:"security",severity:"critical"}]}},
      {...exported,details:{...exported.details,findings:[{key:"http.security.csp",category:"seo",severity:"critical"}]}},
      {...exported,details:{...exported.details,categories:[{key:"security",score:101}]}},
      {...exported,publicIssue:{...exported.publicIssue,body:marker}},
      {...exported,reportPath:"https://attacker.example/report/"+secret},
      {...exported,summary:{...report,runId:"9002"}},
      {...exported,artifactPolicy:{...exported.artifactPolicy,automaticUpload:true}},
      {...exported,details:{...exported.details,checks:Array.from({length:257},()=>exported.details.checks[0])}}
    ];
    for(const data of variants) {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(data));
      const response=await call(req("v1/runs/9001/export","GET"));expect(response.status).toBe(502);
      const output=await response.text();expect(output).not.toContain("synthetic-private-736");expect(output).not.toContain(secret);expect(output).not.toContain("@everyone");
    }
  });
  it("forwards scoped deletion without browser credentials and rejects mismatched or substitute responses",async()=>{
    const deleted={apiVersion:1,runId:"9001",deleted:true};
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(deleted));
    expect((await call(req("v1/runs/9001/report","DELETE"))).status).toBe(200);
    const options=vi.mocked(fetch).mock.calls[0][1];expect(options?.method).toBe("DELETE");
    expect((options?.headers as Headers).has("cookie")).toBe(false);
    for(const data of [{...deleted,runId:"9002"},report,{...deleted,raw:secret}]) {
      vi.mocked(fetch).mockResolvedValueOnce(Response.json(data));
      expect((await call(req("v1/runs/9001/report","DELETE"))).status).toBe(502);
    }
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(deleted));
    expect((await call(req("v1/runs/9001/report","GET"))).status).toBe(502);
  });
});
