import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());
it.each([undefined, "wrong", "test-session"])("checks the private admin cookie (%s)", async token => {
  vi.stubEnv("ADMIN_TOKEN", "test-session");
  const request = new NextRequest("http://localhost/api/auth/status", {
    headers: token ? { cookie: `argos_admin=${token}` } : {},
  });
  const response = await GET(request);
  expect(await response.json()).toEqual({ isAdmin: token === "test-session" });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("does not accept an admin session when the server credential is absent", async () => {
  vi.stubEnv("ADMIN_TOKEN", "");
  const response = await GET(new NextRequest("http://localhost/api/auth/status"));
  expect(await response.json()).toEqual({ isAdmin: false });
});
