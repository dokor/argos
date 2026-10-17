import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { accountProxy } from "./account-proxy";
import { GET as retiredList } from "@/app/api/audits/route";
import { GET as retiredDetail } from "@/app/api/audits/[...path]/route";
import nextConfig from "../../next.config";
import { localizedPath } from "./i18n/routes";

const fetchMock = vi.fn();
const accountRoutes = ["admin/entitlement-options", "admin/users/42/events","admin/users", "admin/users/42", "admin/runs", "admin/runs/42", "admin/runs/42/report", "admin/queue", "admin/queue/tasks", "admin/queue/tasks/BATCH/42", "admin/events", "admin/feedback", "admin/feedback/42", "admin/analytics"];
const legacyRoutes = ["/api/audits", "/api/audits/7/history", "/api/audits/7/history/42/comparison", "/api/audits/runs/42", "/api/audits/runs/42/report"];
function request(path: string, cookie = "") {
  return new NextRequest("https://argos.example" + path, {
    headers: { Cookie: cookie, Authorization: "Bearer forged", "X-User-Id": "42", "X-Role": "ADMIN" },
  });
}
beforeEach(() => {
  vi.stubEnv("ADMIN_API_TOKEN", "synthetic-service");
  vi.stubEnv("API_BASE", "http://backend-fixture");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(legacyRoutes)("keeps the retired read %s closed, including with legacy and account cookies", async path => {
  const response = await (path === "/api/audits" ? retiredList : retiredDetail)();
  expect(response.status).toBe(410);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each(accountRoutes)("never exchanges the legacy cookie for an account session at %s", async path => {
  fetchMock.mockResolvedValue(new Response('{"error":"session_invalid"}', { status: 401 }));
  const response = await accountProxy(request("/api/account/" + path, "argos_admin=synthetic-legacy"), path.split("/"));
  expect(response.status).toBe(401);
  const headers = fetchMock.mock.calls[0][1].headers as Headers;
  expect(headers.has("Authorization")).toBe(false);
  expect(headers.has("X-User-Id")).toBe(false);
  expect(headers.has("X-Role")).toBe(false);
  expect(response.headers.get("cache-control")).toContain("no-store");
});

it.each([
  ["anonymous", "", 401], ["non-admin", "synthetic-user", 403],
  ["admin", "synthetic-admin", 200], ["expired", "synthetic-expired", 401],
  ["revoked", "synthetic-revoked", 401], ["accounts disabled", "synthetic-admin", 503],
] as const)("preserves Java's decision for %s across all account admin reads", async (_state, jwt, status) => {
  // The BFF cannot validate the registry: these fixtures exercise propagation,
  // not a replacement for Java's real authorization and MariaDB tests.
  for (const path of accountRoutes) {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(status === 200 ? '{"items":[]}' : '{"error":"denied"}', { status }));
    const response = await accountProxy(request("/api/account/" + path, jwt ? "argos_account=" + jwt : ""), path.split("/"));
    expect(response.status, path).toBe(status);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe(jwt ? "Bearer " + jwt : null);
    expect(response.cookies.get("argos_account")?.maxAge).toBe(status === 401 ? 0 : undefined);
  }
});

it.each(["fr", "en"] as const)("localizes modern admin destinations in %s", lang => {
  for (const route of ["/account/admin", "/account/admin/runs/42", "/account/admin/feedback", "/account/admin/analytics"]) {
    expect(localizedPath(route, lang)).toBe((lang === "en" ? "/en" : "") + route);
  }
});
it("does not retain aliases for the retired connected interface", async () => {
  const redirects = await nextConfig.redirects!();
  expect(redirects.filter(({source}) => /^\/(?:en\/)?(?:dashboard|login)(?:\/|$)/.test(source))).toEqual([]);
  expect(redirects).toContainEqual({source:"/audit-site-pme",destination:"/ressources/audit-site-pme",permanent:true});
});
