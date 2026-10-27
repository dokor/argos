// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T08:00:00Z"));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (url: string) => Response.json(
    url.endsWith("/csrf") ? { csrf: "c".repeat(43) } : url.endsWith("/auth/renew") ? { accepted: true } : { signedIn: true },
  ));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("renews once before concurrent private requests and renews again after sleep", async () => {
  const { accountFetch } = await import("./account-client");
  await Promise.all([accountFetch("me"), accountFetch("session"), accountFetch("sessions")]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/renew"))).toHaveLength(1);
  expect(fetchMock.mock.calls.map(([url]) => url).slice(0, 2)).toEqual(["/api/account/csrf", "/api/account/auth/renew"]);
  vi.setSystemTime(new Date("2026-10-27T21:00:00Z"));
  await accountFetch("me");
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/renew"))).toHaveLength(2);
});

it("retries a temporary renewal outage before sending private requests", async () => {
  const { accountFetch } = await import("./account-client");
  fetchMock.mockResolvedValueOnce(Response.json({ csrf: "c".repeat(43) }))
    .mockResolvedValueOnce(Response.json({ error: "account_unavailable" }, { status: 503 }));
  await expect(accountFetch("me")).rejects.toMatchObject({ status: 503 });
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/me"))).toBe(false);
  await expect(accountFetch("me")).resolves.toEqual({ signedIn: true });
});

it("reports revoked renewal once and allows a new login to restart renewal", async () => {
  const { accountFetch } = await import("./account-client");
  const invalid = vi.fn(); window.addEventListener("argos-account-invalid", invalid);
  fetchMock.mockResolvedValueOnce(Response.json({ csrf: "c".repeat(43) }))
    .mockResolvedValueOnce(Response.json({ error: "session_invalid" }, { status: 401 }));
  await expect(accountFetch("me")).rejects.toMatchObject({ status: 401 });
  expect(invalid).toHaveBeenCalledOnce();
  await accountFetch("auth/login", "POST", { email: "fixture@example.com", password: "fixture" });
  await accountFetch("me");
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/renew"))).toHaveLength(2);
  window.removeEventListener("argos-account-invalid", invalid);
});

it("renews before creating an audit and keeps public auth independent of session renewal", async () => {
  const { accountFetch, accountAuditHeaders } = await import("./account-client");
  await accountFetch("auth/providers");
  expect(fetchMock).toHaveBeenCalledOnce();
  expect(await accountAuditHeaders()).toEqual({ "X-Argos-CSRF": "c".repeat(43) });
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/renew"))).toHaveLength(1);
});

it.each(["/en/account/settings", "/account/settings"])("preserves the email language and anti-bot proof together on %s", async path => {
  const { accountFetch } = await import('./account-client');
  window.history.replaceState({}, "", path);
  const fetchMock = vi.fn<typeof fetch>(async url => String(url).endsWith("/csrf") ? Response.json({csrf:"synthetic"}) : Response.json({accepted:true}));
  vi.stubGlobal("fetch", fetchMock);
  await accountFetch("auth/register", "POST", {}, undefined, undefined, "synthetic-captcha");
  const init = fetchMock.mock.calls.at(-1)![1] as RequestInit;
  expect((init.headers as Record<string, string>)["Accept-Language"]).toBe(path.startsWith("/en/") ? "en" : "fr");
  expect((init.headers as Record<string, string>)["X-Argos-Captcha"]).toBe("synthetic-captcha");
  window.history.replaceState({}, "", "/");
});
it("invalidates the client session only after a successful password reset", async () => {
  const { accountFetch } = await import('./account-client');
  const invalid = vi.fn(); window.addEventListener("argos-account-invalid", invalid);
  let accepted = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/csrf") ? Response.json({csrf:"synthetic"}) : accepted ? Response.json({accepted:true}) : Response.json({error:"token_invalid"},{status:400})));
  try {
    await expect(accountFetch("auth/reset","POST",{token:"fixture",password:"synthetic passphrase"})).rejects.toMatchObject({code:"token_invalid"});
    expect(invalid).not.toHaveBeenCalled();
    accepted = true;
    await accountFetch("auth/reset","POST",{token:"fixture",password:"synthetic passphrase"});
    expect(invalid).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("argos-account-invalid",invalid); }
});
it("keeps the current client session after a refused login but invalidates it for a protected 401", async () => {
  const { accountFetch } = await import('./account-client');
  const invalid = vi.fn(); window.addEventListener("argos-account-invalid", invalid);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/csrf") ? Response.json({csrf:"synthetic"}) : Response.json({error:"session_invalid"},{status:401})));
  try {
    await expect(accountFetch("auth/login","POST",{email:"test@example.invalid",password:"invalid"})).rejects.toMatchObject({code:"credentials_invalid",status:401});
    expect(invalid).not.toHaveBeenCalled();
    await expect(accountFetch("sessions")).rejects.toMatchObject({code:"session_invalid",status:401});
    expect(invalid).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("argos-account-invalid",invalid); }
});
