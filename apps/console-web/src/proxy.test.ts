import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

it("replaces client-supplied nonces and policies with a fresh matching request/response policy", () => {
  const request = new NextRequest("https://argos.example/", { headers: {
    "x-nonce": "attacker", "Content-Security-Policy": "script-src 'unsafe-inline'",
  } });
  const first = proxy(request);
  const second = proxy(request);
  const nonce = first.headers.get("x-middleware-request-x-nonce")!;
  expect(Buffer.from(nonce, "base64")).toHaveLength(32);
  expect(second.headers.get("x-middleware-request-x-nonce")).not.toBe(nonce);
  const policy = first.headers.get("Content-Security-Policy")!;
  expect(policy).toContain(`'nonce-${nonce}'`);
  expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
  const scripts = policy.split(";").find(part => part.trim().startsWith("script-src "))!;
  expect(scripts).not.toContain("'unsafe-inline'");
  expect(scripts).not.toContain("'unsafe-eval'");
  expect(scripts).toContain("https://challenges.cloudflare.com");
  expect(first.headers.get("Cache-Control")).toBe("private, no-store");
});
