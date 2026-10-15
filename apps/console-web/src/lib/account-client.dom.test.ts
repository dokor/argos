// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { accountFetch } from "./account-client";
afterEach(() => vi.unstubAllGlobals());
it("invalidates the client session only after a successful password reset", async () => {
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
  const invalid = vi.fn(); window.addEventListener("argos-account-invalid", invalid);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/csrf") ? Response.json({csrf:"synthetic"}) : Response.json({error:"session_invalid"},{status:401})));
  try {
    await expect(accountFetch("auth/login","POST",{email:"test@example.invalid",password:"invalid"})).rejects.toMatchObject({code:"credentials_invalid",status:401});
    expect(invalid).not.toHaveBeenCalled();
    await expect(accountFetch("sessions")).rejects.toMatchObject({code:"session_invalid",status:401});
    expect(invalid).toHaveBeenCalledOnce();
  } finally { window.removeEventListener("argos-account-invalid",invalid); }
});
