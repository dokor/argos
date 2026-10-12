import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { accountProxy } from "./account-proxy";
import { adminReadProxy } from "./admin-read-proxy";
import { GET as metrics } from "@/app/api/product-analytics/metrics/route";
import { proxy } from "@/proxy";
import { localizedPath } from "./i18n/routes";

const fetchMock = vi.fn();
const accountRoutes = ["admin/users", "admin/users/42", "admin/runs", "admin/runs/42", "admin/runs/42/report", "admin/queue", "admin/events", "admin/feedback", "admin/feedback/42"];
const legacyRoutes = ["/api/audits", "/api/audits/7/history", "/api/audits/7/history/42/comparison", "/api/audits/runs/42", "/api/audits/runs/42/report", "/api/product-analytics/metrics"];
function request(path: string, cookie = "") {
  return new NextRequest("https://argos.example" + path, {
    headers: { Cookie: cookie, Authorization: "Bearer forged", "X-User-Id": "42", "X-Role": "ADMIN" },
  });
}
beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", "synthetic-legacy");
  vi.stubEnv("ADMIN_API_TOKEN", "synthetic-service");
  vi.stubEnv("API_BASE", "http://backend-fixture");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each(legacyRoutes)("does not turn an account session into a legacy credential for %s", async path => {
  const response = await adminReadProxy(request(path, "argos_account=synthetic-jwt"), path);
  expect(response.status).toBe(401);
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

it("keeps legacy analytics metrics restricted while accounts are unavailable", async () => {
  fetchMock.mockResolvedValue(new Response('{"enabled":false}'));
  expect((await metrics(request("/api/product-analytics/metrics?days=7", "argos_account=synthetic-admin"))).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
  const response = await metrics(request("/api/product-analytics/metrics?days=7", "argos_admin=synthetic-legacy"));
  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith("http://backend-fixture/api/product-analytics/metrics?days=7", expect.objectContaining({
    headers: { Authorization: "Bearer synthetic-service", Accept: "application/json" }, cache: "no-store", redirect: "error",
  }));
});

it.each(["fr", "en"] as const)("preserves localized account destinations and legacy dashboard redirects in %s", lang => {
  for (const path of ["/account/admin", "/account/admin/runs/42", "/account/admin/feedback"]) {
    const localized = localizedPath(path, lang);
    expect(localized).toBe((lang === "en" ? "/en" : "") + path);
    // Account pages perform their own session checks; proxy does not substitute the legacy cookie.
    expect(proxy(request(localized)).headers.get("x-middleware-next")).toBe("1");
  }
  // The legacy dashboard has no /en route today, even when linked from English navigation.
  for (const path of ["/dashboard", "/dashboard/analytics", "/dashboard/report/42"]) {
    expect(localizedPath(path, lang)).toBe(path);
    const response = proxy(request(path, "argos_account=synthetic-admin"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("from")).toBe(path);
    expect(proxy(request(path, "argos_admin=synthetic-legacy")).headers.get("x-middleware-next")).toBe("1");
  }
});
