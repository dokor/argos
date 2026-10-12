import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { accountProxy } from "@/lib/account-proxy";

const fetchMock = vi.fn();
const request = (cookie?: string) => new NextRequest("https://argos.example/api/account/session", {
  headers: { Authorization: "Bearer ignored-client-value", ...(cookie === undefined ? {} : { Cookie: `argos_account=${cookie}` }) },
});
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("API_BASE", "http://fixture-backend");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("returns a non-cacheable anonymous status without contacting the backend", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedIn: false });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("verifies the HttpOnly cookie and exposes no profile details", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ displayName: "Fixture", email: "private@example.com", verified: false }), {
    headers: { "x-argos-session": "renewed-session" },
  }));
  const response = await GET(request("valid-session"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedIn: true });
  expect(fetchMock.mock.calls[0][0]).toBe("http://fixture-backend/api/account/me");
  expect(fetchMock.mock.calls[0][1].headers.get("authorization")).toBe("Bearer valid-session");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.cookies.get("argos_account")?.value).toBe("renewed-session");
  expect(response.cookies.get("argos_account")?.httpOnly).toBe(true);
});

it("treats an expired session as anonymous and clears its cookie", async () => {
  fetchMock.mockResolvedValue(new Response('{"error":"session_invalid"}', { status: 401 }));
  const response = await GET(request("expired-session"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedIn: false });
  expect(response.cookies.get("argos_account")?.maxAge).toBe(0);
});

it("clears an invalid empty cookie without calling the backend", async () => {
  const response = await GET(request(""));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ signedIn: false });
  expect(response.cookies.get("argos_account")?.maxAge).toBe(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

it.each([403, 429, 503])("does not disguise upstream failure %s as an anonymous session", async status => {
  fetchMock.mockResolvedValue(new Response('{"error":"account_unavailable"}', { status }));
  const response = await GET(request("session"));
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: "account_unavailable" });
  expect(response.cookies.has("argos_account")).toBe(false);
});

it("preserves protected me endpoint authentication failures", async () => {
  fetchMock.mockResolvedValue(new Response('{"error":"session_invalid"}', { status: 401 }));
  const response = await accountProxy(request(), ["me"]);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: "session_invalid" });
});
