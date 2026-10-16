import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
const input = { email: " Synthetic@Example.com ", consent: true, locale: "en" };
const request = (data: unknown = input) => new NextRequest("https://argos.example/api/premium-waitlist", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.1", "Cookie": "secret=value" }, body: JSON.stringify(data) });
afterEach(() => vi.unstubAllGlobals());
it("validates input and explicit consent before forwarding", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  for (const data of [null, {}, { ...input, consent: false }, { ...input, consent: "true" }, { ...input, locale: "de" }, { ...input, email: "a@-example.com" }, { ...input, email: "a..b@example.com" }, { ...input, email: "x".repeat(256) }]) expect((await POST(request(data))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it("uses only the dedicated API and a fixed accepted response", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"email":"must-not-echo@example.com"}')); vi.stubGlobal("fetch", fetcher);
  const first = await POST(request()); const second = await POST(request());
  expect(first.status).toBe(200); expect(await first.text()).toBe(await second.text());
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toMatch(/\/api\/premium-waitlist$/);
  expect(init.headers).toEqual({ "Content-Type": "application/json" });
  expect(JSON.parse(init.body)).toEqual({ email: "synthetic@example.com", consent: true, locale: "en" });
  expect(first.headers.get("cache-control")).toBe("no-store");
});
it("preserves rate limits and hides backend errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("private", { status: 429, headers: { "Retry-After": "60" } })).mockRejectedValueOnce(new Error("synthetic@example.com")));
  const limited = await POST(request()); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("60");
  const failure = await POST(request()); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain("synthetic@example.com");
});
