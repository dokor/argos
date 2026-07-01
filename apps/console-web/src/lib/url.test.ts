import { describe, expect, it } from "vitest";
import { hasUrlScheme, normalizeInputUrl } from "./url";

// Covers issue #61: the audit input must accept URLs with or without a scheme.

describe("normalizeInputUrl", () => {
  it("prepends https:// when no scheme is present", () => {
    expect(normalizeInputUrl("example.com")).toBe("https://example.com");
    expect(normalizeInputUrl("argos.lelouet.fr/path")).toBe(
      "https://argos.lelouet.fr/path"
    );
  });

  it("keeps an explicit http:// scheme unchanged", () => {
    expect(normalizeInputUrl("http://example.com")).toBe("http://example.com");
  });

  it("keeps an explicit https:// scheme unchanged", () => {
    expect(normalizeInputUrl("https://example.com")).toBe("https://example.com");
  });

  it("is case-insensitive on the scheme", () => {
    expect(normalizeInputUrl("HTTP://example.com")).toBe("HTTP://example.com");
    expect(normalizeInputUrl("HtTpS://example.com")).toBe("HtTpS://example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeInputUrl("  example.com  ")).toBe("https://example.com");
    expect(normalizeInputUrl("\thttps://example.com\n")).toBe(
      "https://example.com"
    );
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeInputUrl("")).toBe("");
    expect(normalizeInputUrl("   ")).toBe("");
  });

  it("does not mangle a non-http(s) scheme (backend rejects it cleanly)", () => {
    // Without scheme detection this would become "https://ftp://example.com".
    expect(normalizeInputUrl("ftp://example.com")).toBe("ftp://example.com");
  });

  it("treats a bare host with a port as scheme-less", () => {
    expect(normalizeInputUrl("example.com:8080")).toBe(
      "https://example.com:8080"
    );
  });
});

describe("hasUrlScheme", () => {
  it("detects present and absent schemes", () => {
    expect(hasUrlScheme("https://example.com")).toBe(true);
    expect(hasUrlScheme("http://example.com")).toBe(true);
    expect(hasUrlScheme("example.com")).toBe(false);
    expect(hasUrlScheme("example.com:8080")).toBe(false);
  });
});
