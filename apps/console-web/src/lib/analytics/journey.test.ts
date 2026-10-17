import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { accountHeaders, accountProxy } from "@/lib/account-proxy";
import { eventPayload, reservedPremiumEvents } from "./contract";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const csrf = "a".repeat(43);
function request(cookie: string, path = "auth/login", method = "POST") {
  return new NextRequest("https://argos.test/api/account/" + path, {
    method, headers: { origin: "https://argos.test", "x-argos-csrf": csrf,
      "x-argos-measurement": "untrusted", cookie: "argos_account_csrf=" + csrf + "; " + cookie,
      "accept-language": "en", "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ email: "private@example.test", password: "private" }) } : {}),
  });
}
function configure() {
  vi.stubEnv("ACCOUNT_ORIGIN", "https://argos.test");
  vi.stubEnv("PRODUCT_ANALYTICS_ENABLED", "true"); vi.stubEnv("ADMIN_API_TOKEN", "synthetic-server");
}

it("requires renewed consent and builds the measurement credential on the server", () => {
  configure();
  for (const cookie of ["", "argos_product_consent=granted", "argos_product_consent_v2=refused"]) {
    const headers = accountHeaders(request(cookie), true) as Headers;
    expect(headers.has("X-Argos-Measurement")).toBe(false);
  }
  expect((accountHeaders(request("argos_product_consent_v2=granted"), true) as Headers).get("X-Argos-Measurement")).toBe("Bearer synthetic-server");
  vi.stubEnv("PRODUCT_ANALYTICS_ENABLED", "false");
  expect((accountHeaders(request("argos_product_consent_v2=granted"), true) as Headers).has("X-Argos-Measurement")).toBe(false);
});

it("records a failed social callback with only closed fields and keeps its error redirect", async () => {
  configure();
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: "oauth_failed" }, { status: 503 }))
    .mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  const state = "s".repeat(43);
  const response = await accountProxy(request("argos_product_consent_v2=granted; argos_oauth_" + state + "=browser; argos_return_" + state + "=/en/report/synthetic_report_token_012345678901234567890",
    "auth/oauth/google/callback?state=" + state + "&code=private-code", "GET"), ["auth", "oauth", "google", "callback"]);
  expect(response.status).toBe(303);
  expect(fetch.mock.calls[0][1].headers.get("X-Argos-Measurement")).toBe("Bearer synthetic-server");
  const measurement = fetch.mock.calls.find(([url]) => String(url).endsWith("/api/product-analytics"))!;
  expect(JSON.parse(measurement[1].body)).toEqual({ event: "account_auth_rejected", dimensions: { route: "/account/sign-in", lang: "en", placement: "form" }, errorCategory: "service" });
  expect(measurement[1].body).not.toMatch(/private|code|state|email|token/i);
});

it("does not replace the authentication outcome when collection fails", async () => {
  configure();
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ error: "credentials_invalid" }, { status: 401 }))
    .mockRejectedValue(new Error("collector unavailable"));
  vi.stubGlobal("fetch", fetch);
  const response = await accountProxy(request("argos_product_consent_v2=granted"), ["auth", "login"]);
  expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "credentials_invalid" });
});

it("rejects reserved premium events and identifying properties", () => {
  const dimensions = { route: "/account/register", lang: "fr", placement: "page" };
  expect(eventPayload({ event: "account_registration_view", dimensions })).toBeDefined();
  for (const event of reservedPremiumEvents) expect(eventPayload({ event, dimensions })).toBeUndefined();
  for (const key of ["userId", "email", "token", "url", "providerSubject"]) {
    expect(eventPayload({ event: "account_registration_view", dimensions, [key]: "private" })).toBeUndefined();
  }
});

it("does not label a failed social method association as a sign-in failure", async () => {
  configure(); const state = "s".repeat(43);
  const fetch = vi.fn().mockResolvedValue(Response.json({ error: "oauth_failed" }, { status: 503 })); vi.stubGlobal("fetch", fetch);
  const response = await accountProxy(request("argos_product_consent_v2=granted; argos_oauth_" + state + "=browser; argos_return_" + state + "=/en/account/settings; argos_intent_" + state + "=link", "auth/oauth/google/callback?state=" + state + "&code=synthetic", "GET"), ["auth", "oauth", "google", "callback"]);
  expect(response.status).toBe(303); expect(fetch).toHaveBeenCalledOnce();
  expect(response.headers.get("location")).toContain("/en/account/settings");
});
