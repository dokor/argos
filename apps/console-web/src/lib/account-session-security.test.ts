import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { accountProxy, CSRF_COOKIE, SESSION_COOKIE } from "./account-proxy";
import { POST as createAudit } from "@/app/api/audits/route";

const csrf = "c".repeat(43);
const jwt = "synthetic.signed.session";
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("ACCOUNT_ORIGIN", "https://argos.example");
  vi.stubEnv("API_BASE", "http://fixture-backend");
  vi.stubEnv("ADMIN_API_TOKEN", "synthetic-admin-credential");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mutation(path = "account/auth/renew") {
  return new NextRequest("https://argos.example/api/" + path, {
    method: "POST",
    headers: {
      Origin: "https://argos.example",
      "X-Argos-CSRF": csrf,
      Cookie: `${SESSION_COOKIE}=${jwt}; ${CSRF_COOKIE}=${csrf}; argos_admin=forged`,
      Authorization: "Bearer forged-admin",
      "X-Argos-Account-Session": "Bearer forged-account",
      "X-User-Id": "victim",
      "X-Role": "ADMIN",
    },
    body: JSON.stringify(path === "audits" ? { url: "https://example.com" } : {}),
  });
}

it.each(["é".repeat(43), "c".repeat(42), "c".repeat(44), "c".repeat(42) + ".", "d".repeat(43)])(
  "rejects malformed or mismatching CSRF headers with 403: %s",
  async header => {
    for (const path of ["account/auth/renew", "audits"]) {
      const request = mutation(path);
      request.headers.set("X-Argos-CSRF", header);
      const response = path === "audits"
        ? await createAudit(request)
        : await accountProxy(request, ["auth", "renew"]);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "csrf_invalid" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it.each([null, "https://attacker.example", "https://argos.example.attacker.example", "null"])(
  "requires the exact configured origin even with matching CSRF tokens: %s",
  async origin => {
    const request = mutation();
    if (origin === null) request.headers.delete("Origin");
    else request.headers.set("Origin", origin);
    request.headers.set("X-Forwarded-Host", "argos.example");
    request.headers.set("X-Forwarded-Proto", "https");
    expect((await accountProxy(request, ["auth", "renew"])).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

it("relays renewal credentials only through the dedicated cookie and server headers", async () => {
  const renewed = "synthetic.renewed.session";
  fetchMock.mockResolvedValue(Response.json({ accepted: true }, {
    headers: { "X-Argos-Session": renewed },
  }));
  const response = await accountProxy(mutation(), ["auth", "renew"]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://fixture-backend/api/account/auth/renew");
  expect(Object.fromEntries(init.headers)).toEqual({
    accept: "application/json",
    "accept-language": "fr",
    authorization: "Bearer " + jwt,
    "content-type": "application/json",
    cookie: `${CSRF_COOKIE}=${csrf}`,
    origin: "https://argos.example",
    "x-argos-csrf": csrf,
  });
  expect(init.cache).toBe("no-store");
  expect(response.cookies.get(SESSION_COOKIE)).toMatchObject({
    value: renewed, httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 900,
  });
  expect(response.headers.get("X-Argos-Session")).toBeNull();
  expect(await response.json()).toEqual({ accepted: true });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it.each(["session_invalid", "email_unverified"])(
  "never retries a refused personal audit anonymously: %s",
  async error => {
    const status = error === "session_invalid" ? 401 : 403;
    fetchMock.mockResolvedValue(Response.json({ error }, { status }));
    const response = await createAudit(mutation("audits"));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].headers["X-Argos-Account-Session"]).toBe("Bearer " + jwt);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: "https://example.com" });
  },
);
