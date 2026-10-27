import {afterEach,beforeEach,expect,it,vi} from "vitest";
import catalog from "./ci-error-catalog.json";
import {ciManagement,CiManagementError,ciKeyState} from "./ci-management-client";
import {accountAuditHeaders,resetAccountCsrf} from "./account-client";
vi.mock("./account-client",()=>({accountAuditHeaders:vi.fn().mockResolvedValue({"X-Argos-CSRF":"synthetic-csrf"}),resetAccountCsrf:vi.fn()}));
beforeEach(()=>vi.stubGlobal("fetch",vi.fn()));afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
const failure=(code:keyof typeof catalog.errors)=>{const {httpStatus,fr,en,...entry}=catalog.errors[code];void fr;void en;return Response.json({schemaVersion:1,requestId:"49e4eac3-00a9-4de4-81dc-f4686fb677cc",error:{...entry,code,retryAfterSeconds:null}},{status:httpStatus});};
it("uses the same-origin browser session/CSRF and never adds a machine credential",async()=>{
  vi.mocked(fetch).mockResolvedValue(Response.json({items:[]}));await ciManagement("keys");
  expect(fetch).toHaveBeenCalledWith("/api/account/ci/keys",expect.objectContaining({method:"GET",redirect:"error",cache:"no-store"}));expect(accountAuditHeaders).not.toHaveBeenCalled();
  vi.mocked(fetch).mockResolvedValue(Response.json({}));await ciManagement("keys","POST",{name:"Deployment"});
  expect(fetch).toHaveBeenLastCalledWith("/api/account/ci/keys",expect.objectContaining({headers:{"Content-Type":"application/json","X-Argos-CSRF":"synthetic-csrf"}}));
  expect(vi.mocked(fetch).mock.calls.every(([,options])=>!(options?.headers as Record<string,string>).Authorization)).toBe(true);
});
it("reconstructs controlled errors and refreshes CSRF only for a rejected request, without replaying a mutation",async()=>{
  vi.mocked(fetch).mockResolvedValue(failure("REQUEST_REJECTED"));await expect(ciManagement("keys","POST",{})).rejects.toMatchObject({code:"REQUEST_REJECTED",requestId:"49e4eac3-00a9-4de4-81dc-f4686fb677cc"});
  expect(resetAccountCsrf).toHaveBeenCalledOnce();expect(fetch).toHaveBeenCalledOnce();
});
it("never returns raw errors, incompatible error actions, redirects, or oversized bodies",async()=>{
  const wrong=await failure("FEATURE_NOT_AVAILABLE").json();wrong.error.actionCode="synthetic-secret";
  for(const response of [Response.json({error:"synthetic-secret"},{status:500}),new Response("synthetic-secret",{headers:{"content-type":"text/html"}}),Response.json(wrong,{status:403}),Response.json({value:"x".repeat(262145)})]){
    vi.mocked(fetch).mockResolvedValueOnce(response);const caught=await ciManagement("status").catch(e=>e);expect(caught).toBeInstanceOf(CiManagementError);expect(caught instanceof CiManagementError&&caught.code).toBe("TRANSPORT_FAILED");expect(String(caught)).not.toContain("synthetic-secret");
  }
});
it("distinguishes active, overlap, expired and revoked credentials without assuming a never-used key is broken",()=>{
  const base={expiresAt:"2027-10-18T12:00:00Z",revokedAt:null,overlapUntil:null} as Parameters<typeof ciKeyState>[0],now=Date.parse("2026-10-19T10:00:00Z");
  expect(ciKeyState(base,now)).toBe("active");expect(ciKeyState({...base,overlapUntil:"2026-10-19T10:15:00Z"},now)).toBe("overlap");
  expect(ciKeyState({...base,overlapUntil:"2026-10-19T10:00:00Z"},now)).toBe("expired");expect(ciKeyState({...base,expiresAt:"2026-10-18T12:00:00Z"},now)).toBe("expired");expect(ciKeyState({...base,revokedAt:"2026-10-18T12:00:00Z"},now)).toBe("revoked");
});
