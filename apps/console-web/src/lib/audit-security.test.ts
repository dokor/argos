import { describe, expect, it } from "vitest";
import { ssrfError } from "./audit-url-validation";
import { boundedJson } from "./bounded-request";

describe("audit admission", () => {
  it.each(["http://127.1", "http://2130706433", "http://0x7f000001", "https://u:p@example.com",
    "https://example.com:8443", "http://100.64.0.1", "http://192.0.2.1", "http://224.0.0.1",
    "http://[fe90::1]", "http://[::ffff:8.8.8.8]", "http://[2001:db8::1]", "https://localhost.",
    "https://example.com\\@localhost", "https://example.com\n", "file:///etc/passwd"])("rejects %s", url => {
    expect(ssrfError(url)).not.toBeNull();
  });
  it.each(["example.com", "http://example.com:80/path?q=1", "https://example.com", "https://[2606:4700:4700::1111]"])("accepts %s", url => {
    expect(ssrfError(url)).toBeNull();
  });
  it("bounds bytes without trusting Content-Length and cancels oversized chunked bodies", async () => {
    let cancelled = false;
    const request = new Request("http://localhost", { method: "POST", duplex: "half",
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(9000)); }, cancel() { cancelled = true; } })
    } as RequestInit);
    await expect(boundedJson(request)).rejects.toThrow(RangeError);
    expect(cancelled).toBe(true);
  });
  it("accepts a bounded JSON object and rejects declared overflows", async () => {
    await expect(boundedJson(new Request("http://localhost", { method: "POST", body: '{"url":"example.com"}' }))).resolves.toEqual({ url: "example.com" });
    await expect(boundedJson(new Request("http://localhost", { method: "POST", headers: { "Content-Length": "8193" }, body: '{}' }))).rejects.toThrow(RangeError);
  });
});
