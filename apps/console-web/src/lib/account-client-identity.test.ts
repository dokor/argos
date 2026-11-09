import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { accountHeaders, accountProxy } from "./account-proxy";

const secret = "a".repeat(64);
const timestamp = 1794211200;
beforeEach(() => {
  vi.stubEnv("ARGOS_ACCOUNT_PROXY_SECRET", secret);
  vi.spyOn(Date, "now").mockReturnValue(timestamp * 1000);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function request(extra: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/account/auth/providers", { headers: {
    "x-forwarded-for": "203.0.113.8",
    "forwarded": "for=192.0.2.9",
    "x-real-ip": "192.0.2.10",
    "x-argos-client-ip": "192.0.2.11",
    "x-argos-client-proof": "forged",
    ...extra,
  } });
}
function headers(extra: Record<string, string> = {}) {
  const result = accountHeaders(request(extra), false);
  expect(result).toBeInstanceOf(Headers);
  return result as Headers;
}

it.each(["", "b".repeat(64), "é".repeat(64), secret + "," + secret])(
  "ignores all claimed identities without an authenticated edge (%s)", edge => {
    const result = headers({ "x-argos-edge-key": edge });
    for (const name of ["x-argos-client-ip", "x-argos-client-proof", "x-forwarded-for", "forwarded", "x-real-ip", "x-argos-edge-key"])
      expect(result.has(name)).toBe(false);
  });

it.each(["", "short", "A".repeat(64)])("fails closed when the deployment secret is invalid (%s)", value => {
  vi.stubEnv("ARGOS_ACCOUNT_PROXY_SECRET", value);
  expect(headers({ "x-argos-edge-key": value }).has("x-argos-client-ip")).toBe(false);
});

it.each(["203.0.113.8", "2001:db8::8", "::ffff:203.0.113.8"])(
  "signs only the final ingress hop, ignoring browser-supplied addresses (%s)", client => {
    const result = headers({ "x-argos-edge-key": secret, "x-forwarded-for": `192.0.2.1, ${client}` });
    expect(result.get("x-argos-client-ip")).toBe(client);
    expect(result.get("x-argos-client-proof")).toBe(timestamp + "." + createHmac("sha256", secret)
      .update(`argos-client-v1\n${timestamp}\n${client}`).digest("hex"));
    expect(result.has("x-argos-edge-key")).toBe(false);
    expect(result.has("x-forwarded-for")).toBe(false);
  });

it.each(["", "example.com", "203.0.113.8:80", "[2001:db8::8]", "fe80::1%eth0", "192.0.2.1,", "x".repeat(4097)])(
  "does not sign a malformed final hop (%s)", client => {
    expect(headers({ "x-argos-edge-key": secret, "x-forwarded-for": client }).has("x-argos-client-ip")).toBe(false);
  });

it("forwards the assertion privately and preserves Retry-After without returning internal headers", async () => {
  const upstream = vi.fn().mockResolvedValue(Response.json({ error: "rate_limited" }, {
    status: 429, headers: { "Retry-After": "900", "X-Argos-Edge-Key": secret, "X-Argos-Client-Proof": "internal" },
  }));
  vi.stubGlobal("fetch", upstream);
  const response = await accountProxy(request({ "x-argos-edge-key": secret }), ["auth", "providers"]);
  expect(upstream.mock.calls[0][1].headers.get("x-argos-client-ip")).toBe("203.0.113.8");
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("900");
  expect(response.headers.has("x-argos-edge-key")).toBe(false);
  expect(response.headers.has("x-argos-client-proof")).toBe(false);
});
