import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

afterEach(() => vi.unstubAllGlobals());
const request = () => new NextRequest("http://localhost/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.1", "X-Real-IP": "203.0.113.2" }, body: JSON.stringify({ email: "synthetic@example.com" }) });
describe("public newsletter proxy", () => {
  it("does not delegate forged identity headers and makes duplicates indistinguishable", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ status: "ok" })).mockResolvedValueOnce(Response.json({ status: "already_subscribed" }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await POST(request()); const second = await POST(request());
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(await first.json()).toEqual(await second.json());
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.has("X-Forwarded-For")).toBe(false); expect(headers.has("X-Real-IP")).toBe(false);
  });
  it("preserves retry delay on rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "30" } })));
    const response = await POST(request());
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30"); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
