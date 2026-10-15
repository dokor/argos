import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as csrfRoute } from "@/app/api/account/csrf/route";
import { accountHeaders, accountProxy, CSRF_COOKIE } from "./account-proxy";

const productionOrigin = "https://argos.lelouet.fr";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ACCOUNT_ORIGIN", undefined);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
  vi.stubEnv("API_BASE", "http://fixture-backend");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function mutation(origin: string, path = "auth/register") {
  const bootstrap = await csrfRoute(new NextRequest(origin + "/api/account/csrf"));
  const { csrf } = await bootstrap.json();
  const cookie = bootstrap.cookies.get(CSRF_COOKIE)!;
  return {
    bootstrap,
    request: new NextRequest(origin + "/api/account/" + path, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: `${CSRF_COOKIE}=${cookie.value}`,
        "X-Argos-CSRF": csrf,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "fixture@example.com", password: "fixture passphrase", displayName: "Fixture" }),
    }),
  };
}

it.each(["auth/register", "auth/login", "auth/forgot"])("forwards %s from the production origin without optional environment variables", async path => {
  const { bootstrap, request } = await mutation(productionOrigin, path);
  expect(bootstrap.cookies.get(CSRF_COOKIE)?.secure).toBe(true);
  expect(bootstrap.cookies.get(CSRF_COOKIE)?.httpOnly).toBe(true);
  fetchMock.mockResolvedValue(new Response('{"accepted":true}', {
    headers: { "X-Argos-Session": "synthetic.signed.session" },
  }));
  const response = await accountProxy(request, path.split("/"));
  expect(response.status).toBe(200);
  const headers = fetchMock.mock.calls[0][1].headers as Headers;
  expect(headers.get("origin")).toBe(productionOrigin);
  expect(headers.get("x-argos-csrf")).toBe(bootstrap.cookies.get(CSRF_COOKIE)?.value);
  expect(response.cookies.get("argos_account")?.secure).toBe(true);
  expect(response.cookies.get("argos_account")?.httpOnly).toBe(true);
});

it.each(["https://attacker.example", "http://localhost:3000"])("rejects %s in production even with a matching token and forged proxy headers", async origin => {
  const { request } = await mutation(origin);
  request.headers.set("Host", "argos.lelouet.fr");
  request.headers.set("X-Forwarded-Host", "argos.lelouet.fr");
  request.headers.set("X-Forwarded-Proto", "https");
  const response = await accountProxy(request, ["auth", "register"]);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "csrf_invalid" });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("keeps the localhost default for development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const { bootstrap, request } = await mutation("http://localhost:3000");
  expect(bootstrap.cookies.get(CSRF_COOKIE)?.secure).toBe(false);
  const headers = accountHeaders(request, true);
  expect(headers).toBeInstanceOf(Headers);
  expect((headers as Headers).get("origin")).toBe("http://localhost:3000");
});

it("uses the configured public site when no account origin is specified", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example/");
  const { request } = await mutation("https://site.example");
  expect((accountHeaders(request, true) as Headers).get("origin")).toBe("https://site.example");
});

it("prefers the runtime account origin over the public site and normalizes its trailing slash", async () => {
  vi.stubEnv("ACCOUNT_ORIGIN", "https://account.example/");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example");
  const { bootstrap, request } = await mutation("https://account.example");
  expect(bootstrap.cookies.get(CSRF_COOKIE)?.secure).toBe(true);
  expect((accountHeaders(request, true) as Headers).get("origin")).toBe("https://account.example");
  request.headers.set("Origin", "https://site.example");
  expect(accountHeaders(request, true)).not.toBeInstanceOf(Headers);
});
