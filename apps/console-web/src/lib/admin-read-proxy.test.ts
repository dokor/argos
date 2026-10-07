import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { adminReadProxy } from "./admin-read-proxy";
import { GET as list, POST as create } from "@/app/api/audits/route";
import { GET as detail } from "@/app/api/audits/[...path]/route";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", "synthetic-cookie");
  vi.stubEnv("ADMIN_API_TOKEN", "synthetic-server-secret");
  vi.stubEnv("API_BASE", "http://backend-fixture");
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = (cookie?: string) => new NextRequest("http://localhost/api/audits", {
  headers: { Authorization: "Bearer attacker-header", ...(cookie ? { Cookie: `argos_admin=${cookie}` } : {}) },
});
it.each([undefined, "wrong", "synthetic-cookie-extra"])("rejects cookie %s before any backend call", async cookie => {
  expect((await list(request(cookie))).status).toBe(401); expect(fetchMock).not.toHaveBeenCalled();
});
it("injects only the server credential for a valid cookie and disables caching", async () => {
  fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
  const response = await list(request("synthetic-cookie"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/audits?limit=50"), expect.objectContaining({
    headers: { Authorization: "Bearer synthetic-server-secret", Accept: "application/json" }, cache: "no-store", redirect: "error",
  }));
});
it.each([["runs","1"], ["1","history"], ["1","history","2","comparison"], ["runs","1","report"]])("protects numeric route %j", async (...path) => {
  expect((await detail(request(), { params: Promise.resolve({ path }) })).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("serves the admin report by run ID without reconstructing a public credential", async () => {
  fetchMock.mockResolvedValue(new Response('{"domain":"example.com"}', { status: 200 }));
  const response = await detail(request("synthetic-cookie"), { params: Promise.resolve({ path: ["runs", "1", "report"] }) });
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toBe("http://backend-fixture/api/audits/runs/1/report");
  expect(await response.json()).toEqual({ domain: "example.com" });
});
it("proxies a requested comparison with the server credential", async () => {
  fetchMock.mockResolvedValue(new Response('{"comparison":{"reason":"NO_PREVIOUS_REPORT"}}', { status: 200 }));
  const response = await detail(request("synthetic-cookie"),
    { params: Promise.resolve({ path: ["7", "history", "42", "comparison"] }) });
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls[0][0]).toBe("http://backend-fixture/api/audits/7/history/42/comparison");
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer synthetic-server-secret");
});
it("fails closed if server credential is absent", async () => {
  vi.stubEnv("ADMIN_API_TOKEN", "");
  expect((await adminReadProxy(request("synthetic-cookie"), "/api/audits")).status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("public creation still proxies without either admin credential", async () => {
  vi.stubEnv("ADMIN_TOKEN", ""); vi.stubEnv("ADMIN_API_TOKEN", "");
  fetchMock.mockResolvedValue(new Response('{"reportToken":"synthetic-created-token"}', { status: 200 }));
  const response = await create(new NextRequest("http://localhost/api/audits", { method: "POST", body: JSON.stringify({ url: "https://example.com" }) }));
  expect(response.status).toBe(200);
  expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
});
