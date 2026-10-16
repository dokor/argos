import { beforeEach, afterEach, it, expect, vi } from "vitest";
it("validates shared-link creation and enforces CSRF before forwarding",async()=>{
 const path=["runs","42","share"];
 expect((await accountProxy(request(path.join("/"),"POST",{days:30},false),path)).status).toBe(403);
 for(const body of [{days:365},{days:"30"},{days:30,ownerId:99}])expect((await accountProxy(request(path.join("/"),"POST",body),path)).status).toBe(400);
 expect(fetchMock).not.toHaveBeenCalled();fetchMock.mockResolvedValue(Response.json({token:"a".repeat(43)}));
 expect((await accountProxy(request(path.join("/"),"POST",{days:30}),path)).status).toBe(200);
 expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer "+jwt);
});
it.each(["reports","shared-reports"])("forwards authenticated %s reads privately",async kind=>{
 const path=[kind,"a".repeat(43)];fetchMock.mockResolvedValue(Response.json({access:"full"}));
 const response=await accountProxy(request(path.join("/")),path);expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
 expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer "+jwt);
});
it("forwards only the implemented connected profile catalogue with a private account session", async () => {
  fetchMock.mockResolvedValue(Response.json({ defaultProfileId: "server-default-v1", items: [] }));
  const response = await accountProxy(request("analysis-profiles"), ["analysis-profiles"]);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/analysis-profiles");
  expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer " + jwt);
});
it.each(["ownerId=2", "profileId=mobile-v1", "limit=1"])("rejects unexpected catalogue input %s", async query => {
  expect((await accountProxy(request("analysis-profiles?" + query), ["analysis-profiles"])).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["overview","pages"])("forwards the private inventory route %s and its filters",async path=>{
 fetchMock.mockResolvedValue(Response.json({items:[]}));
 const result=await accountProxy(request(path+"?attention=priority&offset=20&domainId=9007199254740993"),[path]);
 expect(result.status).toBe(200);expect(result.headers.get("Cache-Control")).toBe("private, no-store");
 const url=new URL(fetchMock.mock.calls[0][0]);expect(url.searchParams.get("attention")).toBe("priority");expect(url.searchParams.get("offset")).toBe("20");expect(url.searchParams.get("domainId")).toBe("9007199254740993");
});
it.each(["ownerId=20","attention=healthy","query=a&query=b","domainId=9223372036854775808"])("rejects overview filters before forwarding %s",async query=>{
 expect((await accountProxy(request("overview?"+query),["overview"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["7", "30", "90"])("forwards analytics period %s with the account JWT", async days => {
  fetchMock.mockResolvedValue(Response.json({ enabled: false }));
  expect((await accountProxy(request("admin/analytics?days=" + days), ["admin", "analytics"])).status).toBe(200);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://fixture-backend/api/account/admin/analytics?days=" + days);
  expect(init.headers.get("authorization")).toBe("Bearer " + jwt);
});
it.each(["days=1", "days=7&days=30", "role=ADMIN", "days=7.0"])("rejects forged analytics query %s before forwarding", async query => {
  expect((await accountProxy(request("admin/analytics?" + query), ["admin", "analytics"])).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("forwards admin reads with the Argos session, never the legacy admin secret",async()=>{
 fetchMock.mockResolvedValue(new Response('{"items":[],"nextCursor":null}'));
 const response=await accountProxy(request("admin/runs?user=42&site=example.com&status=FAILED&from=2026-10-01&until=2026-10-11&limit=20"),["admin","runs"]);
 expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
 const [url,init]=fetchMock.mock.calls[0];expect(url).toContain("/api/account/admin/runs?user=42&site=example.com");
 expect(init.headers.get("authorization")).toBe("Bearer "+jwt);expect(init.headers.has("x-user-id")).toBe(false);
});
it.each(["role=ADMIN","limit=101","limit=1&limit=2","cursor=-1"])("rejects forged admin parameters %s",async query=>{
 expect((await accountProxy(request("admin/users?"+query),["admin","users"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it("allows only explicit entitlement changes with CSRF",async()=>{
 const path=["admin","users","42","entitlement"],body={offer:"FREE",monthlyLimit:0,confirmation:true,expectedVersion:1,reasonCode:"PLAN_ADJUSTMENT"};
 expect((await accountProxy(request(path.join("/"),"PATCH",body,false),path)).status).toBe(403);
 for(const bad of [{...body,role:"ADMIN"},{...body,monthlyLimit:-1},{...body,monthlyLimit:1.5},{...body,confirmation:false},{...body,expectedVersion:-1},{...body,reasonCode:"arbitrary text"},{...body,monthlyLimit:Number.MAX_SAFE_INTEGER+1}]) {
  expect((await accountProxy(request(path.join("/"),"PATCH",bad),path)).status).toBe(400);
 }
 expect(fetchMock).not.toHaveBeenCalled();
 fetchMock.mockResolvedValue(new Response('{"changed":true}'));
 expect((await accountProxy(request(path.join("/"),"PATCH",body),path)).status).toBe(200);
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
 expect(fetchMock.mock.calls[0][1].headers.get("x-argos-csrf")).toBe(csrf);
});
it.each([["POST","admin/users"],["PATCH","admin/users/42/role"],["DELETE","admin/runs/42"]])("rejects unimplemented admin action %s %s",async(method,path)=>{
 expect((await accountProxy(request(path,method,{}),path.split("/"))).status).toBe(404);expect(fetchMock).not.toHaveBeenCalled();
});
import { NextRequest, NextResponse } from "next/server";
import { accountProxy, accountHeaders, safeAccountReturn, saveRunProof, claimContext, SESSION_COOKIE } from "./account-proxy";
import { localizedAccountReturn } from "./account-navigation";
it("protects introduction publication and revocation with CSRF and forwards only published fields", async () => {
  const path = ["report-introduction", "f".repeat(43)];
  const body = { author: "Fixture", context: "Synthetic context", nextStep: "Review together", findingKeys: ["html.title", "html.h1.count"] };
  expect((await accountProxy(request(path.join("/"), "PUT", body, false), path)).status).toBe(403);
  expect((await accountProxy(request(path.join("/"), "DELETE", undefined, false), path)).status).toBe(403);
  expect((await accountProxy(request(path.join("/"), "PUT", { ...body, ownerId: "forged" }), path)).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue(Response.json({ introduction: null }));
  expect((await accountProxy(request(path.join("/"), "PUT", body), path)).status).toBe(200);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
  expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer " + jwt);
});
import { GET as csrfRoute } from "@/app/api/account/csrf/route";
import { POST as create } from "@/app/api/audits/route";
it("preserves scope, cookie identity and quota rejection for a targeted audit",async()=>{
  const scope={kind:"check",target:"html.title"};
  const req=request("audits","POST",{url:"https://example.com",scope,ownerId:"forged"});
  fetchMock.mockResolvedValue(Response.json({error:"quota_exceeded"},{status:429,headers:{"Retry-After":"60"}}));
  const response=await create(req);
  expect(response.status).toBe(429);expect(response.headers.get("Retry-After")).toBe("60");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({url:"https://example.com",scope});
  expect(fetchMock.mock.calls[0][1].headers["X-Argos-Account-Session"]).toBe("Bearer "+jwt);
});
it("applies CSRF and SSRF validation to a targeted audit before forwarding",async()=>{
  const scope={kind:"category",target:"seo"};
  expect((await create(request("audits","POST",{url:"https://example.com",scope},false))).status).toBe(403);
  expect((await create(request("audits","POST",{url:"http://127.0.0.1/",scope}))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([{kind:"category",target:"ssl"},{kind:"check",target:"html.title",ownerId:99},{kind:"full",target:"html.title"}])("rejects invalid analysis scope %j",async scope=>{
  expect((await create(request("audits","POST",{url:"https://example.com",scope}))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["/account/urls/9/history","/en/account/urls/9/history"])("preserves history return destination %s",path=>expect(safeAccountReturn(path)).toBe(path));
it("forwards history pagination with cookie identity only",async()=>{
  fetchMock.mockResolvedValue(new Response('{"items":[],"nextCursor":null}'));
  const response=await accountProxy(request("urls/9/history?limit=1&cursor=42"),["urls","9","history"]);
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/urls/9/history?limit=1&cursor=42");
  expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer "+jwt);
});
it.each(["ownerId=2","limit=101","cursor=-1"])("rejects forged history pagination %s",async query=>{
  expect((await accountProxy(request("urls/9/history?"+query),["urls","9","history"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["/account/sites","/account/sites/42","/en/account/sites/42","/account/runs/42","/en/account/runs/42"])("accepts only concrete private return destinations %s", path => {
  expect(safeAccountReturn(path)).toBe(path);
});
it.each(["/account/sites/../42","/account/sites/%34%32","/account/sites/42?owner=7","//evil.example/account/sites","/account/sites/0"])("rejects ambiguous private return destinations %s", path => {
  expect(safeAccountReturn(path)).toBe("/account/sites");
});
it("forwards bounded site pagination without identity parameters",async()=>{
  fetchMock.mockResolvedValue(new Response('{"items":[],"nextCursor":null}'));
  const response=await accountProxy(request("sites?limit=25&cursor=42"),["sites"]);
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/sites?limit=25&cursor=42");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each(["sites?limit=101","sites?limit=2.5","sites?cursor=-1","sites?ownerId=42"])("rejects invalid site query %s",async path=>{
  expect((await accountProxy(request(path),["sites"])).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([{url:"http://127.0.0.1"},{url:"https://example.com",ownerId:"victim"},{url:"file:///etc/passwd"}])("rejects unsafe site additions before forwarding",async body=>{
  expect((await accountProxy(request("sites","POST",body),["sites"])).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("requires CSRF for additions and never permits deletion",async()=>{
  expect((await accountProxy(request("sites","POST",{url:"https://example.com"},false),["sites"])).status).toBe(403);
  expect((await accountProxy(request("sites/42","DELETE",{}),["sites","42"])).status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});
const csrf = "c".repeat(43), jwt = "synthetic.signed.credential", fetchMock = vi.fn();
it.each(["invalid_state", "missing_browser_cookie", "backend_response", "backend_transport"] as const)("logs only safe OAuth categories at %s", async stage => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const state = "s".repeat(43), secret = "never-log-code-token-email-cookie";
    const callback = request(`auth/oauth/linkedin/callback?state=${stage === "invalid_state" ? secret : state}&code=${secret}&error_description=${secret}`);
    if (stage !== "missing_browser_cookie") callback.cookies.set("argos_oauth_" + state, secret);
    if (stage === "backend_response") fetchMock.mockResolvedValue(Response.json({ error: secret, detail: secret }, { status: 400 }));
    if (stage === "backend_transport") fetchMock.mockRejectedValue(new Error(secret));
    const response = await accountProxy(callback, ["auth", "oauth", "linkedin", "callback"]);
    expect(response.status).toBe(303);
    expect(warn).toHaveBeenCalledExactlyOnceWith("account_oauth_callback_rejected", {
      provider: "linkedin", stage, error: stage === "backend_transport" ? "account_unavailable" : "oauth_invalid",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(state);
    if (stage === "invalid_state" || stage === "missing_browser_cookie") expect(fetchMock).not.toHaveBeenCalled();
  } finally { warn.mockRestore(); }
});
it("maps a rejected login without deleting an existing session, while protected 401s still delete it", async () => {
  fetchMock.mockImplementation(async () => Response.json({error:"session_invalid",detail:"private"},{status:401}));
  const login = await accountProxy(request("auth/login","POST",{email:"test@example.invalid",password:"invalid"}),["auth","login"]);
  expect(login.status).toBe(401);
  expect(await login.json()).toEqual({error:"credentials_invalid"});
  expect(login.cookies.has("argos_account")).toBe(false);
  expect(login.headers.get("cache-control")).toContain("no-store");
  for (const path of ["me","sessions","auth/renew"]) {
    const protectedResponse = await accountProxy(request(path,path === "auth/renew" ? "POST" : "GET",path === "auth/renew" ? {} : undefined),path.split("/"));
    expect(protectedResponse.cookies.get("argos_account")?.maxAge).toBe(0);
  }
});
it("exposes only the current owner's read-only usage and rejects identity queries",async()=>{
  fetchMock.mockResolvedValue(new Response('{"used":2,"limit":null}'));
  expect((await accountProxy(request("usage"),["usage"])).status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/usage");
  fetchMock.mockReset();expect((await accountProxy(request("usage?userId=42"),["usage"])).status).toBe(400);
  expect((await accountProxy(request("usage","POST",{}),["usage"])).status).toBe(404);expect(fetchMock).not.toHaveBeenCalled();
});
it("preserves quota errors and reset retry while keeping the account cookie",async()=>{
  fetchMock.mockResolvedValue(new Response('{"error":"quota_exceeded"}',{status:429,headers:{"Retry-After":"12345"}}));
  const response=await accountProxy(request("runs/42/claim","POST",{}),["runs","42","claim"]);
  // Claim requires a browser proof; use the usage read to verify general error forwarding.
  expect(response.status).toBe(404);
  const usage=await accountProxy(request("usage"),["usage"]);expect(usage.status).toBe(429);
  expect(usage.headers.get("retry-after")).toBe("12345");expect(usage.cookies.has("argos_account")).toBe(false);
  expect(await usage.json()).toEqual({error:"quota_exceeded"});
});
beforeEach(() => { vi.stubEnv("ACCOUNT_ORIGIN", "https://argos.example"); vi.stubEnv("API_BASE", "http://fixture-backend"); vi.stubEnv("ADMIN_API_TOKEN", "synthetic-admin"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function request(path: string, method = "GET", body?: unknown, secure = true, cookie = true) {
  return new NextRequest("https://argos.example/api/account/" + path, { method, headers: {
    Authorization: "Bearer forged", "X-User-Id": "victim", "X-Argos-Run-Proof": "forged",
    ...(cookie ? { Cookie: "argos_account=" + jwt + "; argos_account_csrf=" + csrf } : {}),
    ...(secure ? { Origin: "https://argos.example", "X-Argos-CSRF": csrf } : {}),
  }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
it("strips identity, proof and admin headers and uses only the dedicated cookie", async () => {
  fetchMock.mockResolvedValue(new Response('{"verified":true}'));
  const response = await accountProxy(request("me"), ["me"]);
  const init = fetchMock.mock.calls[0][1], headers = init.headers as Headers;
  expect(headers.get("authorization")).toBe("Bearer " + jwt); expect(headers.get("x-user-id")).toBeNull(); expect(headers.get("x-argos-run-proof")).toBeNull();
  expect(headers.get("authorization")).not.toContain("synthetic-admin"); expect(init.cache).toBe("no-store"); expect(response.headers.get("cache-control")).toContain("no-store");
});
it.each(["sessions", "methods", "runs", "me"])("never treats an admin cookie as user identity for %s", async path => {
  fetchMock.mockResolvedValue(new Response('{"error":"session_invalid"}', { status: 401 }));
  const r = new NextRequest("https://argos.example/api/account/" + path, { headers: { Cookie: "argos_admin=synthetic-admin", Authorization: "Bearer forged" } });
  expect((await accountProxy(r, [path])).status).toBe(401); expect(fetchMock.mock.calls[0][1].headers.has("Authorization")).toBe(false);
});
it.each(["auth/login", "auth/register", "auth/logout", "runs/42/claim"])("rejects missing CSRF/origin before forwarding %s", async path => {
  expect((await accountProxy(request(path, "POST", {}, false), path.split("/"))).status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects a mismatched or foreign-origin CSRF proof", () => {
  const r = request("me", "PATCH", {}); r.headers.set("Origin", "https://attacker.example");
  expect(accountHeaders(r, true)).toBeInstanceOf(NextResponse);
  r.headers.set("Origin", "https://argos.example"); r.headers.set("X-Argos-CSRF", "d".repeat(43)); expect(accountHeaders(r, true)).toBeInstanceOf(NextResponse);
});
it("keeps JWTs out of JSON and sets secure HttpOnly cookies at login and renewal", async () => {
  fetchMock.mockResolvedValue(new Response('{"verified":true}', { headers: { "X-Argos-Session": jwt } }));
  const response = await accountProxy(request("auth/login", "POST", { email: "fixture@example.com", password: "synthetic" }), ["auth", "login"]);
  expect(await response.text()).not.toContain(jwt); expect(response.headers.get("x-argos-session")).toBeNull();
  const cookie = response.cookies.get("argos_account"); expect(cookie?.httpOnly).toBe(true); expect(cookie?.secure).toBe(true); expect(cookie?.sameSite).toBe("lax");
  expect(cookie?.value).toBe(jwt);
});
it("clears the session cookie after rejection, logout and archive and relays Retry-After", async () => {
  fetchMock.mockResolvedValue(new Response('{"error":"session_invalid"}', { status: 401 }));
  expect((await accountProxy(request("me"), ["me"])).cookies.get("argos_account")?.maxAge).toBe(0);
  fetchMock.mockResolvedValue(new Response('{"error":"rate_limited"}', { status: 429, headers: { "Retry-After": "123" } }));
  expect((await accountProxy(request("auth/login", "POST", {}), ["auth", "login"])).headers.get("retry-after")).toBe("123");
});
it("blocks route traversal, unsupported methods and excessive bodies", async () => {
  expect((await accountProxy(request("me"), ["..", "audits"])).status).toBe(404);
  expect((await accountProxy(request("methods", "PATCH", {}), ["methods"])).status).toBe(404);
  expect((await accountProxy(request("auth/login", "POST", { padding: "a".repeat(9000) }), ["auth", "login"])).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("keeps email verification return paths in the browser without adding fields to Java DTOs", async () => {
  fetchMock.mockResolvedValue(new Response('{"accepted":true}'));
  const returnTo = "/report/" + "r".repeat(43);
  const response = await accountProxy(request("auth/register", "POST", { email: "fixture@example.com", password: "synthetic", displayName: "Fixture", returnTo }), ["auth", "register"]);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("returnTo");
  expect(response.cookies.get("argos_account_return")?.value).toBe(returnTo);
  expect(response.cookies.get("argos_account_return")?.httpOnly).toBe(true);
});
it.each(["fr","en"] as const)("keeps the selected language and nested context through an OAuth callback in %s", async lang => {
  const target = localizedAccountReturn("/en/account/runs/42?returnTo="+encodeURIComponent("/en/account?attention=priority&domainId=7"),lang);
  const state="s".repeat(43), browser="b".repeat(43);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({state,url:"https://provider.example/authorize"}),{headers:{"X-Argos-OAuth-Browser":browser}}));
  const started=await accountProxy(request("auth/oauth/github/start","POST",{intent:"login",returnTo:target}),["auth","oauth","github","start"]);
  expect(started.cookies.get("argos_return_"+state)?.value).toBe(target);
  const callback=request("auth/oauth/github/callback?state="+state+"&code=synthetic");
  callback.cookies.set("argos_oauth_"+state,browser);
  callback.cookies.set("argos_return_"+state,target);
  fetchMock.mockResolvedValue(new Response('{"returnTo":"/account"}',{headers:{"X-Argos-Session":jwt}}));
  const completed=await accountProxy(callback,["auth","oauth","github","callback"]);
  expect(completed.headers.get("location")).toBe("https://argos.example"+target);
  expect(completed.cookies.get("argos_account_return")?.value).toBe(target);
  expect(fetchMock.mock.calls.at(-1)![1].headers.get("Accept-Language")).toBe(lang);
});

it.each(["auth/resend", "auth/reset", "auth/reauth", "methods/password", "methods/42/remove"])("forwards the supported email language for %s", async path => {
  for (const language of ["en", "fr", "de", "en,fr;q=0.9"]) {
    fetchMock.mockReset().mockResolvedValue(Response.json({ accepted: true }));
    const input = request(path, "POST", {});
    input.headers.set("Accept-Language", language);
    expect((await accountProxy(input, path.split("/"))).status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers.get("Accept-Language")).toBe(language === "en" ? "en" : "fr");
  }
});

it.each(["auth/register", "auth/forgot"])("preserves the private return context and sends only its language for %s", async path => {
  for (const target of ["/en/account/settings?section=profile", "/account/settings?section=profile", "https://evil.example"]) {
    fetchMock.mockReset().mockResolvedValue(new Response('{"accepted":true}'));
    const response = await accountProxy(request(path, "POST", { email:"fixture@example.invalid", returnTo:target }),path.split("/"));
    const safe = safeAccountReturn(target);
    expect(response.cookies.get("argos_account_return")?.value).toBe(safe);
    expect(response.cookies.get("argos_account_return")?.httpOnly).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.get("Accept-Language")).toBe(safe.startsWith("/en/") ? "en" : "fr");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({email:"fixture@example.invalid"});
  }
});
it("clears the current browser session after successful reset, but not after a refused token", async () => {
  for (const status of [400,200]) {
    fetchMock.mockResolvedValue(new Response('{}',{status}));
    const response = await accountProxy(request("auth/reset","POST",{token:"synthetic",password:"synthetic passphrase"}),["auth","reset"]);
    expect(response.cookies.get(SESSION_COOKIE)?.maxAge).toBe(status === 200 ? 0 : undefined);
  }
});
it("forwards confirmation actions as POST and session revocation without a DELETE body", async () => {
  fetchMock.mockResolvedValue(new Response('{"accepted":true}'));
  const archived = await accountProxy(request("me/archive", "POST", { confirmed: true }), ["me", "archive"]);
  expect(fetchMock.mock.calls[0][1].body).toBe('{"confirmed":true}');
  expect(archived.cookies.get("argos_account")?.maxAge).toBe(0);
  await accountProxy(request("sessions/42", "DELETE", {}), ["sessions", "42"]);
  expect(fetchMock.mock.calls[1][1]).not.toHaveProperty("body");
});
it("CSRF bootstrap returns a browser token without exposing the session cookie", async () => {
  const response = await csrfRoute(request("csrf")); expect((await response.json()).csrf).toBe(csrf);
  expect(response.cookies.get("argos_account_csrf")?.httpOnly).toBe(true); expect(response.cookies.has("argos_account")).toBe(false);
});
it("anonymous proofs are separate HttpOnly cookies bound to a precise run and report", async () => {
  const base = request("me"), response = NextResponse.json({}), proof = "p".repeat(43);
  saveRunProof(base, response, "42", "shared-report", proof);
  const next = new NextRequest("https://argos.example", { headers: { Cookie: response.cookies.getAll().map(c => c.name + "=" + encodeURIComponent(c.value)).join("; ") } });
  expect(claimContext(next, "shared-report")).toBe("42"); expect(claimContext(next, "other-report")).toBeNull();
  expect(response.cookies.get("argos_run_42")?.httpOnly).toBe(true); expect(response.cookies.get("argos_account_claims")?.value).not.toContain("shared-report");
  fetchMock.mockResolvedValue(new Response('{"accepted":true}'));
  const claim = request("runs/42/claim", "POST", {}); claim.cookies.set("argos_run_42", proof);
  expect((await accountProxy(claim, ["runs", "42", "claim"])).status).toBe(200); expect(fetchMock.mock.calls[0][1].headers.get("x-argos-run-proof")).toBe(proof);
});
it("a shared report or forged proof header cannot claim a run without the browser cookie", async () => {
  expect((await accountProxy(request("runs/42/claim", "POST", {}), ["runs", "42", "claim"])).status).toBe(404); expect(fetchMock).not.toHaveBeenCalled();
});
it("bounds browser proofs to eight runs and preserves separate tabs", () => {
  const current = request("me");
  for (let id = 1; id <= 9; id++) {
    const response = NextResponse.json({});
    saveRunProof(current, response, String(id), "report-" + id, "p".repeat(43));
    for (const cookie of response.cookies.getAll()) {
      if (cookie.maxAge === 0) current.cookies.delete(cookie.name);
      else current.cookies.set(cookie.name, cookie.value);
    }
  }
  expect(current.cookies.has("argos_run_1")).toBe(false);
  expect(claimContext(current, "report-2")).toBe("2");
  expect(claimContext(current, "report-9")).toBe("9");
  expect(JSON.parse(current.cookies.get("argos_account_claims")!.value)).toHaveLength(8);
});
it("OAuth uses a browser cookie per transaction and keeps report tokens out of backend storage", async () => {
  const state = "s".repeat(43), report = "r".repeat(43), browser = "b".repeat(43);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: "https://provider.example", state }), { headers: { "X-Argos-OAuth-Browser": browser } }));
  const result = await accountProxy(request("auth/oauth/google/start", "POST", { intent: "login", returnTo: "/report/" + report }), ["auth", "oauth", "google", "start"]);
  expect(fetchMock.mock.calls[0][1].body).not.toContain(report); expect(result.cookies.get("argos_return_" + state)?.value).toBe("/report/" + report);
  expect(result.headers.get("x-argos-oauth-browser")).toBeNull();
  const callback = new NextRequest("https://argos.example/api/account/auth/oauth/google/callback?state=" + state + "&code=synthetic", { headers: { Cookie: "argos_oauth_" + state + "=" + browser + ";argos_return_" + state + "=/report/" + report + ";argos_account_csrf=" + csrf } });
  fetchMock.mockResolvedValue(new Response('{"returnTo":"/account"}', { headers: { "X-Argos-Session": jwt } }));
  const completed = await accountProxy(callback, ["auth", "oauth", "google", "callback"]);
  expect(completed.headers.get("location")).toBe("https://argos.example/report/" + report); expect(completed.cookies.get("argos_oauth_" + state)?.maxAge).toBe(0);
});
it.each(["google", "github", "linkedin"])("preserves an existing-account refusal from the %s callback without issuing a session", async provider => {
  const state = "s".repeat(43), report = "r".repeat(43);
  const callback = request(`auth/oauth/${provider}/callback?state=${state}&code=synthetic`);
  callback.cookies.set("argos_oauth_" + state, "b".repeat(43));
  callback.cookies.set("argos_return_" + state, "/report/" + report);
  fetchMock.mockResolvedValue(Response.json({ error: "use_existing_account", detail: "never disclose" }, { status: 409, headers: { "X-Argos-Session": "must-not-be-used" } }));
  const response = await accountProxy(callback, ["auth", "oauth", provider, "callback"]);
  expect(response.headers.get("location")).toBe("https://argos.example/account/sign-in?error=use_existing_account");
  expect(response.cookies.has("argos_account")).toBe(false);
  expect(response.cookies.get("argos_account_return")?.value).toBe("/report/" + report);
  expect(response.cookies.get("argos_account_return")?.httpOnly).toBe(true);
  expect(response.cookies.get("argos_oauth_" + state)?.maxAge).toBe(0);
  expect(response.cookies.get("argos_return_" + state)?.maxAge).toBe(0);
  expect(response.headers.get("location")).not.toContain(report);
  expect(response.headers.get("location")).not.toContain("never disclose");
});
it.each([
  [403, "reauth_required"], [401, "session_invalid"], [429, "rate_limited"],
  [503, "provider_unavailable"], [409, "method_unavailable"], [400, "oauth_invalid"],
])("preserves public callback error %s %s in the user's language", async (status, error) => {
  const state = "s".repeat(43);
  const callback = request(`auth/oauth/linkedin/callback?state=${state}&code=synthetic`);
  callback.cookies.set("argos_oauth_" + state, "b".repeat(43));
  callback.cookies.set("argos_return_" + state, "/en/account");
  fetchMock.mockResolvedValue(Response.json({ error }, { status: Number(status) }));
  const response = await accountProxy(callback, ["auth", "oauth", "linkedin", "callback"]);
  expect(response.headers.get("location")).toBe("https://argos.example/en/account/sign-in?error=" + error);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.cookies.has("argos_account")).toBe(status === 401);
  if (status === 401) expect(response.cookies.get("argos_account")?.maxAge).toBe(0);
});
it.each(['{"error":"<script>secret</script>"}', '{"error":{"message":"secret"}}', 'secret upstream HTML'])("does not disclose an unknown or malformed callback response", async body => {
  const state = "s".repeat(43), callback = request(`auth/oauth/linkedin/callback?state=${state}`);
  callback.cookies.set("argos_oauth_" + state, "b".repeat(43));
  fetchMock.mockResolvedValue(new Response(body, { status: 400 }));
  const response = await accountProxy(callback, ["auth", "oauth", "linkedin", "callback"]);
  expect(response.headers.get("location")).toBe("https://argos.example/account/sign-in?error=oauth_invalid");
  expect(response.cookies.has("argos_account")).toBe(false);
});
it("describes an upstream server failure without a public error code as a service outage", async () => {
  const state = "s".repeat(43), callback = request(`auth/oauth/linkedin/callback?state=${state}`);
  callback.cookies.set("argos_oauth_" + state, "b".repeat(43));
  fetchMock.mockResolvedValue(Response.json({}, { status: 500 }));
  const response = await accountProxy(callback, ["auth", "oauth", "linkedin", "callback"]);
  expect(response.headers.get("location")).toBe("https://argos.example/account/sign-in?error=account_unavailable");
});
it("cleans up a failed callback when the backend is unreachable and preserves its private return destination", async () => {
  const state = "s".repeat(43), callback = request(`auth/oauth/linkedin/callback?state=${state}`);
  callback.cookies.set("argos_oauth_" + state, "b".repeat(43));
  callback.cookies.set("argos_return_" + state, "/en/account/sites");
  fetchMock.mockRejectedValue(new Error("secret network details"));
  const response = await accountProxy(callback, ["auth", "oauth", "linkedin", "callback"]);
  expect(response.headers.get("location")).toBe("https://argos.example/en/account/sign-in?error=account_unavailable");
  expect(response.cookies.get("argos_account_return")?.value).toBe("/en/account/sites");
  expect(response.cookies.get("argos_oauth_" + state)?.maxAge).toBe(0);
  expect(response.cookies.get("argos_return_" + state)?.maxAge).toBe(0);
  expect(response.cookies.has("argos_account")).toBe(false);
});
it.each(["https://evil.example", "//evil.example", "/\\evil", "/account?token=secret", "/api/audits", "/report/token#secret"])("rejects unsafe return paths %s", path => { expect(safeAccountReturn(path)).toBe("/account/sites"); });
it("audit creation never silently drops a presented invalid session or exposes claim secrets", async () => {
  const r = new NextRequest("https://argos.example/api/audits", { method: "POST", body: JSON.stringify({ url: "https://example.com", ownerId: "victim" }), headers: { Cookie: "argos_account=" + jwt + ";argos_account_csrf=" + csrf, Origin: "https://argos.example", "X-Argos-CSRF": csrf } });
  fetchMock.mockResolvedValue(new Response('{"error":"session_invalid"}', { status: 401 }));
  expect((await create(r)).status).toBe(401); expect(fetchMock.mock.calls[0][1].headers["X-Argos-Account-Session"]).toBe("Bearer " + jwt);
  expect(fetchMock.mock.calls[0][1].body).not.toContain("ownerId");
});

it("never downgrades an explicitly personal audit to anonymous when its cookie expired",async()=>{
 const r=new NextRequest("https://argos.example/api/audits",{method:"POST",body:JSON.stringify({url:"https://example.com",personal:true})});
 expect((await create(r)).status).toBe(401);expect(fetchMock).not.toHaveBeenCalled();
});

it("validates URL, CSRF and idempotency before private admission, forwarding no forged identity",async()=>{
  const body={url:"https://example.com/path",profileId:"server-default-v1"};
  const key="12345678-1234-1234-1234-123456789012";
  expect((await accountProxy(request("analyses","POST",body,false),["analyses"])).status).toBe(403);
  expect((await accountProxy(request("analyses","POST",body),["analyses"])).status).toBe(400);
  for(const invalid of [{...body,url:"http://127.0.0.1"},{...body,ownerId:"forged"},{...body,url:"x".repeat(2049)}]) {
    const r=request("analyses","POST",invalid);r.headers.set("Idempotency-Key",key);
    expect((await accountProxy(r,["analyses"])).status).toBe(400);
  }
  expect(fetchMock).not.toHaveBeenCalled();
  fetchMock.mockResolvedValue(Response.json({runId:"42",status:"QUEUED"}));
  const r=request("analyses","POST",body);r.headers.set("Idempotency-Key",key);
  expect((await accountProxy(r,["analyses"])).status).toBe(200);
  const [url,options]=fetchMock.mock.calls[0];
  expect(url).toBe("http://fixture-backend/api/account/analyses");
  expect(options.headers.get("Idempotency-Key")).toBe(key);
  expect(options.headers.get("Authorization")).toBe("Bearer "+jwt);
  expect(options.headers.has("X-User-Id")).toBe(false);
});
it("forwards bounded literal site search but does not open filters on history",async()=>{
  fetchMock.mockResolvedValue(Response.json({items:[],nextCursor:null}));
  expect((await accountProxy(request("sites?q=shop%25&limit=1"),["sites"])).status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toContain("q=shop%25");
  fetchMock.mockClear();
  expect((await accountProxy(request("sites?q="+"a".repeat(201)),["sites"])).status).toBe(400);
  expect((await accountProxy(request("urls/9/history?q=shop"),["urls","9","history"])).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(["/account/settings", "/en/account/settings?section=connections", "/account/settings?section=security"])("accepts the concrete settings destination %s",path=>expect(safeAccountReturn(path)).toBe(path));
it.each(["/account/settings?section=connections&redirect=//evil.example", "/account/settings?section=evil", "/account/settings#secret"])("rejects forged settings return %s",path=>expect(safeAccountReturn(path)).toBe("/account/sites"));
it.each(["fr","en"])("returns a cancelled provider link to settings in %s",async lang=>{
 const state="s".repeat(43),callback=request(`auth/oauth/github/callback?state=${state}&error=access_denied&error_description=secret`);
 callback.cookies.set("argos_oauth_"+state,"b".repeat(43));callback.cookies.set("argos_intent_"+state,"link");callback.cookies.set("argos_return_"+state,(lang==="en" ? "/en":"")+"/account/settings?section=connections");
 fetchMock.mockResolvedValue(Response.json({error:"oauth_invalid"},{status:400}));
 const response=await accountProxy(callback,["auth","oauth","github","callback"]);
 expect(response.headers.get("location")).toBe("https://argos.example"+(lang==="en" ? "/en":"")+"/account/settings?section=connections&error=oauth_cancelled");
 expect(response.cookies.get("argos_intent_"+state)?.maxAge).toBe(0);expect(response.cookies.get("argos_oauth_"+state)?.maxAge).toBe(0);expect(response.cookies.get("argos_return_"+state)?.maxAge).toBe(0);expect(fetchMock.mock.calls[0][0]).not.toContain("secret");expect(response.cookies.has("argos_account")).toBe(false);
});

it("keeps a failed login on sign-in even when the intended destination is settings",async()=>{
 const state="s".repeat(43),callback=request(`auth/oauth/github/callback?state=${state}&error=access_denied`);
 callback.cookies.set("argos_oauth_"+state,"b".repeat(43));callback.cookies.set("argos_intent_"+state,"login");callback.cookies.set("argos_return_"+state,"/en/account/settings?section=security");
 fetchMock.mockResolvedValue(Response.json({error:"oauth_invalid"},{status:400}));
 const response=await accountProxy(callback,["auth","oauth","github","callback"]);
 expect(response.headers.get("location")).toBe("https://argos.example/en/account/sign-in?error=oauth_cancelled");
 expect(response.cookies.get("argos_account_return")?.value).toBe("/en/account/settings?section=security");expect(response.cookies.get("argos_intent_"+state)?.maxAge).toBe(0);
});
it.each(["login","link"])("stores the OAuth %s UI intent in an expiring HttpOnly cookie",async intent=>{
 const state="s".repeat(43);fetchMock.mockResolvedValue(Response.json({state,url:"https://github.com/login/oauth/authorize"},{headers:{"X-Argos-OAuth-Browser":"b".repeat(43)}}));
 const response=await accountProxy(request("auth/oauth/github/start","POST",{intent,returnTo:"/en/account/settings?section=connections"}),["auth","oauth","github","start"]);
 expect(response.cookies.get("argos_intent_"+state)).toMatchObject({value:intent,httpOnly:true,secure:true,sameSite:"lax",maxAge:600});
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({intent,returnTo:"/en/account"});
});

it("forwards private usage history with period/offset and cookie identity only",async()=>{
 fetchMock.mockResolvedValue(Response.json({items:[],total:0,limit:20,offset:0,period:"2026-10",snapshotAt:"2026-10-14T08:00:00Z"}));
 const response=await accountProxy(request("usage/events?period=2026-10&limit=20&offset=40"),["usage","events"]);
 expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");
 expect(fetchMock.mock.calls[0][0]).toContain("/api/account/usage/events?period=2026-10&limit=20&offset=40");expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer "+jwt);
});
it.each(["ownerId=2","period=2026-13","period=2026-10&period=2026-09","offset=-1","offset=9007199254740992","limit=101","limit=20&limit=1"])("rejects invalid usage history query %s",async query=>{
 expect((await accountProxy(request("usage/events?"+query),["usage","events"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});

const discoveryInput={hostname:"example.com",maxUrls:50,maxDepth:3,excludedPaths:["/private"]};
it("forwards bounded discovery with session, CSRF and idempotency key",async()=>{
  fetchMock.mockResolvedValue(Response.json({id:"9007199254740993",status:"QUEUED"},{status:202}));
  const req=request("domain-discoveries","POST",discoveryInput);req.headers.set("idempotency-key","12345678-1234-1234-1234-123456789012");
  const response=await accountProxy(req,["domain-discoveries"]);expect(response.status).toBe(202);
  expect(fetchMock.mock.calls[0][1].headers.get("idempotency-key")).toBe("12345678-1234-1234-1234-123456789012");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(discoveryInput);
});
it.each([{hostname:"127.0.0.1"},{hostname:"[::1]"},{hostname:"user@example.com"},{hostname:"example.com:81"},{hostname:"example.com/path"},{maxUrls:1001},{maxDepth:11},{maxUrls:0},{maxUrls:-1},{maxUrls:1.5},{maxUrls:"200"},{maxUrls:null},{maxDepth:0.5},{maxDepth:true},{excludedPaths:["/a?token=secret"]},{ownerId:"2"}])("rejects invalid discovery input %j",async changes=>{
  const req=request("domain-discoveries","POST",{...discoveryInput,...changes});req.headers.set("idempotency-key","12345678-1234-1234-1234-123456789012");
  expect((await accountProxy(req,["domain-discoveries"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["ownerId=2","limit=101","offset=-1","inclusion=other","limit=1&limit=2"])("rejects invalid discovery page query %s",async query=>{
  expect((await accountProxy(request("domain-discoveries/123/pages?"+query),["domain-discoveries","123","pages"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it("preserves the selected discovery scope and opaque id",async()=>{
  fetchMock.mockResolvedValue(Response.json({items:[],total:0,limit:20,offset:20}));
  expect((await accountProxy(request("domain-discoveries/9007199254740993/pages?inclusion=eligible&offset=20"),["domain-discoveries","9007199254740993","pages"])).status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/domain-discoveries/9007199254740993/pages?limit=20&offset=20&inclusion=eligible");
});
it("requires CSRF and an empty body to cancel discovery",async()=>{
  const path=["domain-discoveries","123","cancel"];
  expect((await accountProxy(request(path.join("/"),"POST",{},false),path)).status).toBe(403);
  expect((await accountProxy(request(path.join("/"),"POST",{ownerId:2}),path)).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});

const batchInput={discoveryId:"9007199254740993",selectedPageIds:["9007199254740994","9007199254740995"],profileId:"server-default-v1"};
it("forwards an atomic batch selection with opaque ids and idempotency",async()=>{
 fetchMock.mockResolvedValue(new Response(JSON.stringify({batchId:"123"}),{status:202}));
 const req=request("domain-batches","POST",batchInput);req.headers.set("idempotency-key","12345678-1234-1234-1234-123456789012");
 expect((await accountProxy(req,["domain-batches"])).status).toBe(202);
 expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(batchInput);
 expect(fetchMock.mock.calls[0][1].headers.get("Idempotency-Key")).toBe("12345678-1234-1234-1234-123456789012");
});
it.each([{selectedPageIds:[]},{selectedPageIds:["1","1"]},{selectedPageIds:[1]},{selectedPageIds:["9223372036854775808"]},{selectedPageIds:Array.from({length:51},(_,i)=>String(i+1))},{ownerId:"2"},{discoveryId:2},{profileId:"../invalid"}])("rejects invalid batch %j",async changes=>{
 const req=request("domain-batches","POST",{...batchInput,...changes});req.headers.set("idempotency-key","12345678-1234-1234-1234-123456789012");
 expect((await accountProxy(req,["domain-batches"])).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["status=bogus","limit=101","offset=-1","ownerId=2","status=FAILED&status=RUNNING"])("rejects invalid batch filter %s",async query=>{
 const path="domains/1/batches/2/progress/pages";expect((await accountProxy(request(path+"?"+query),path.split("/"))).status).toBe(400);expect(fetchMock).not.toHaveBeenCalled();
});
it("forwards private progress pages and preserves filters",async()=>{
 fetchMock.mockResolvedValue(new Response("{}"));const path="domains/1/batches/2/progress/pages";
 const result=await accountProxy(request(path+"?status=FAILED&offset=2"),path.split("/"));expect(result.status).toBe(200);expect(result.headers.get("Cache-Control")).toBe("private, no-store");
 expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/"+path+"?limit=20&offset=2&status=FAILED");
});
it("proxies F08 summary routes privately",async()=>{
 fetchMock.mockImplementation(async () => new Response("{}"));
 for(const path of ["domains/1/batches/2","domains/1/batches/2/pages","domains/1/batches"]){expect((await accountProxy(request(path),path.split("/"))).status).toBe(200);}expect(fetchMock).toHaveBeenCalledTimes(3);
});
it("requires CSRF and an empty cancel payload",async()=>{
 const path="domains/1/batches/2/cancel";
 expect((await accountProxy(request(path,"POST",{runId:"3"}),path.split("/"))).status).toBe(400);
 const req=request(path,"POST",{});req.headers.delete("x-argos-csrf");expect((await accountProxy(req,path.split("/"))).status).toBe(403);expect(fetchMock).not.toHaveBeenCalled();
});
it("recovers an admission only by validated key and session, with private caching",async()=>{
  const key="12345678-1234-1234-1234-123456789012";
  fetchMock.mockResolvedValue(Response.json({runId:"42",status:"COMPLETED"}));
  const response=await accountProxy(request("analyses/"+key),["analyses",key]);
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/analyses/"+key);
  expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer "+jwt);
  fetchMock.mockClear();
  expect((await accountProxy(request("analyses/"+key+"?ownerId=forged"),["analyses",key])).status).toBe(400);
  expect((await accountProxy(request("analyses/bad-key"),["analyses","bad-key"])).status).toBe(404);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("reads the effective discovery capabilities from Java without exposing transport configuration",async()=>{
 fetchMock.mockResolvedValue(Response.json({maxUrls:200,maxDepth:5,defaultUrls:20,defaultDepth:2,durationSeconds:60}));
 const response=await accountProxy(request("domain-discoveries/limits"),["domain-discoveries","limits"]);
 expect(response.status).toBe(200);expect((await response.json()).maxUrls).toBe(200);
 expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/domain-discoveries/limits");
});
it("forwards higher absolute discovery bounds for authoritative server validation",async()=>{
 fetchMock.mockResolvedValue(Response.json({error:"discovery_limits_invalid"},{status:400}));
 const req=request("domain-discoveries","POST",{...discoveryInput,maxUrls:200,maxDepth:5});req.headers.set("idempotency-key","12345678-1234-1234-1234-123456789012");
 const response=await accountProxy(req,["domain-discoveries"]);
 expect(response.status).toBe(400);expect((await response.json()).error).toBe("discovery_limits_invalid");
 expect(fetchMock).toHaveBeenCalledOnce();
});

it("validates measurement mutations and keeps deployment guards authoritative",async()=>{
 const path=["admin","analytics","settings"], body={enabled:true,expectedVersion:0,confirmation:true};
 expect((await accountProxy(request(path.join("/"),"PATCH",body,false),path)).status).toBe(403);
 expect((await accountProxy(request(path.join("/"),"PATCH",{...body,confirmation:false}),path)).status).toBe(400);
 expect((await accountProxy(request(path.join("/"),"PATCH",body),path)).status).toBe(409);
 expect(fetchMock).not.toHaveBeenCalled();
 vi.stubEnv("PRODUCT_ANALYTICS_ENABLED","true");vi.stubEnv("ADMIN_API_TOKEN","synthetic");
 fetchMock.mockResolvedValue(Response.json({enabled:true,version:1,deploymentAllowed:true}));
 const response=await accountProxy(request(path.join("/"),"PATCH",body),path);
 expect(response.status).toBe(200);expect((await response.json()).bffAllowed).toBe(true);
 expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer "+jwt);
 expect(fetchMock.mock.calls[0][1].headers.get("x-argos-csrf")).toBe(csrf);
});
it.each(["www.exemple.fr","www.redpoint.fr"])("preserves exact www discovery host %s in the BFF",async hostname=>{
 const path=["domain-discoveries"];
 fetchMock.mockResolvedValue(Response.json({hostname}));
 const req=request(path.join("/"),"POST",{hostname,maxUrls:20,maxDepth:2,excludedPaths:[]});req.headers.set("Idempotency-Key","12345678-1234-1234-1234-123456789abc");
 expect((await accountProxy(req,path)).status).toBe(200);
 expect(JSON.parse(fetchMock.mock.calls[0][1].body).hostname).toBe(hostname);
});
