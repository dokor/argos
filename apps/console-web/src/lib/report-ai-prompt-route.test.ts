import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/account/report-ai-prompt/[kind]/[id]/route";
import historical from "@/components/report/fixtures/historical-report.json";
import en from "./i18n/en.json";

const fetchMock = vi.fn();
function request(kind = "run", id = "42", cookie = true, query = "") {
  return new NextRequest(`http://localhost/api/account/report-ai-prompt/${kind}/${id}${query}`, {
    headers: { ...(cookie ? { cookie: "argos_account=test-session" } : {}), "Accept-Language": "en", Authorization: "Bearer forged" },
  });
}
function run(kind = "run", id = "42", cookie = true, query = "") {
  return GET(request(kind, id, cookie, query), { params: Promise.resolve({ kind, id }) });
}
beforeEach(() => { vi.stubEnv("API_BASE", "http://fixture-backend"); vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Premium prompt endpoint", () => {
  it("requires a session before any upstream read", async () => {
    expect((await run("run", "42", false)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["FREE", "CI", "STANDARD", "premium", undefined])("refuses the %s offer before fetching report details", async offer => {
    fetchMock.mockResolvedValueOnce(Response.json({ offer }));
    const response = await run();
    expect(response.status).toBe(403); expect(await response.json()).toEqual({ error: "premium_required" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([["run", "42", "runs/42/report"], ["report", "a".repeat(43), "reports/" + "a".repeat(43)], ["shared", "b".repeat(43), "shared-reports/" + "b".repeat(43)]])("checks entitlement and %s report access before returning the localized prompt", async (kind, id, path) => {
    fetchMock.mockResolvedValueOnce(Response.json({ offer: "PREMIUM" })).mockResolvedValueOnce(Response.json(historical));
    const response = await run(kind, id);
    expect(response.status).toBe(200); expect((await response.json()).prompt).toContain(en.report.aiPrompt.promptIntro);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["http://fixture-backend/api/account/usage", "http://fixture-backend/api/account/" + path]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.get("Authorization")).toBe("Bearer test-session");
      expect(options.cache).toBe("no-store"); expect(options.redirect).toBe("error");
    }
  });
  it.each([401, 403, 404, 410, 503])("preserves backend access failure %s", async status => {
    fetchMock.mockResolvedValueOnce(Response.json({ offer: "PREMIUM" })).mockResolvedValueOnce(Response.json({ error: "resource_unavailable" }, { status }));
    const response = await run(); expect(response.status).toBe(status); expect(await response.json()).not.toHaveProperty("prompt");
  });
  it("does not treat a revoked session or an unverified account as Premium", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "email_unverified" }, { status: 403 }));
    expect((await run()).status).toBe(403); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects summary-only data even with a Premium offer", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ offer: "PREMIUM" })).mockResolvedValueOnce(Response.json({ ...historical, access: "summary" }));
    expect((await run()).status).toBe(403);
  });
  it.each([["admin", "42", ""], ["run", "../42", ""], ["report", "short", ""], ["run", "42", "?offer=PREMIUM"], ["run", "42", "?ownerId=1"]])("rejects forged paths and parameters", async (kind, id, query) => {
    expect((await run(kind, id, true, query)).status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed for malformed upstream data and transport errors", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ offer: "PREMIUM" })).mockResolvedValueOnce(Response.json({}));
    expect((await run()).status).toBe(503);
    fetchMock.mockRejectedValueOnce(new Error("offline")); expect((await run()).status).toBe(503);
  });
});
