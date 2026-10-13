import { beforeEach, afterEach, it, expect, vi } from "vitest";
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
 const path=["admin","users","42","entitlement"],body={offer:"FREE",monthlyLimit:0,confirmed:true};
 expect((await accountProxy(request(path.join("/"),"PATCH",body,false),path)).status).toBe(403);
 for(const bad of [{...body,role:"ADMIN"},{...body,monthlyLimit:-1},{...body,monthlyLimit:1.5},{...body,confirmed:false},{...body,monthlyLimit:Number.MAX_SAFE_INTEGER+1}]) {
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
import { accountProxy, accountHeaders, safeAccountReturn, saveRunProof, claimContext } from "./account-proxy";
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
