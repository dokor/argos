import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
// Next 16.3.8 still exports the matcher test helper under its historical name.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

function request(path: string, token?: string) {
  return new NextRequest(`https://argos.example${path}`, {
    headers: token === undefined ? {} : { cookie: `argos_admin=${token}` },
  });
}

describe("legacy dashboard protection", () => {
  it.each(["/dashboard", "/dashboard/", "/dashboard/audits/42"])(
    "protects %s and preserves its login destination",
    path => {
      vi.stubEnv("ADMIN_TOKEN", "synthetic-admin-token");
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);

      for (const token of [undefined, "", "invalid", "synthetic-admin-token-extra"]) {
        const response = proxy(request(`${path}?filter=failed`, token));
        expect(response.status).toBe(307);
        const login = new URL(response.headers.get("location")!);
        expect(login.origin).toBe("https://argos.example");
        expect(login.pathname).toBe("/login");
        expect(login.searchParams.get("from")).toBe(path);
        expect([...login.searchParams.keys()]).toEqual(["from"]);
      }

      const response = proxy(request(path, "synthetic-admin-token"));
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.has("location")).toBe(false);
    },
  );

  it.each([undefined, ""])("fails closed when ADMIN_TOKEN is %s", expected => {
    vi.stubEnv("ADMIN_TOKEN", expected);
    for (const token of [undefined, "", "synthetic-admin-token"]) {
      expect(proxy(request("/dashboard", token)).status).toBe(307);
    }
  });
});

it.each([
  "/", "/en", "/login", "/en/login", "/dashboard-preview",
  "/report/synthetic-token", "/en/report/synthetic-token",
  "/account/admin", "/en/account/admin",
  "/api/audits", "/api/newsletter", "/api/account/session",
  "/api/auth/login", "/api/auth/status", "/api/reports/synthetic-token/status",
  "/api/audits/runs/42", "/api/audits/42/history",
])("does not intercept %s", path => {
  expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(false);
});
