// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { accountFetch } from "./account-client";
afterEach(() => vi.unstubAllGlobals());
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
