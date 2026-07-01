import { describe, expect, it } from "vitest";
import {
  maskEmail,
  maskToken,
  redactDetails,
  redactScalar,
  safeError,
  sanitizeText,
  sanitizeUrl,
} from "./log-sanitize";

// ─── sanitizeText ──────────────────────────────────────────────────────────

describe("sanitizeText", () => {
  it("returns null for falsy inputs", () => {
    expect(sanitizeText(null)).toBeNull();
    expect(sanitizeText(undefined)).toBeNull();
    expect(sanitizeText("")).toBeNull();
  });

  it("replaces control characters with spaces", () => {
    expect(sanitizeText("foo\r\nbar\tbaz")).toBe("foo  bar baz");
  });

  it("truncates at 200 characters", () => {
    const long = "a".repeat(300);
    expect(sanitizeText(long)).toHaveLength(200);
  });

  it("returns short clean strings unchanged", () => {
    expect(sanitizeText("hello world")).toBe("hello world");
  });
});

// ─── sanitizeUrl ───────────────────────────────────────────────────────────

describe("sanitizeUrl", () => {
  it("returns null for falsy inputs", () => {
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
  });

  it("strips query-string and fragment", () => {
    expect(sanitizeUrl("https://example.com/path?secret=abc#frag")).toBe("example.com/path");
  });

  it("prepends https:// when scheme is missing", () => {
    expect(sanitizeUrl("example.com/path")).toBe("example.com/path");
  });

  it("keeps the pathname", () => {
    expect(sanitizeUrl("https://argos.lelouet.fr/report/tok")).toBe("argos.lelouet.fr/report/tok");
  });

  it("falls back to sanitizeText for unparseable input", () => {
    // Contains characters that confuse URL but not sanitizeText
    const weird = "not a url at all!!";
    const result = sanitizeUrl(weird);
    expect(typeof result).toBe("string");
  });
});

// ─── maskToken ─────────────────────────────────────────────────────────────

describe("maskToken", () => {
  it("returns null for null/undefined", () => {
    expect(maskToken(null)).toBeNull();
    expect(maskToken(undefined)).toBeNull();
  });

  it("returns **** for short tokens", () => {
    expect(maskToken("abc")).toBe("****");
    expect(maskToken("12345678")).toBe("****");
  });

  it("masks the middle of longer tokens", () => {
    const result = maskToken("abcdefghijklmnop");
    expect(result).toBe("abcd…mnop");
    expect(result).toHaveLength(9); // 4 + ellipsis + 4
  });

  it("accepts numbers", () => {
    expect(maskToken(123456789)).toBe("1234…6789");
  });
});

// ─── maskEmail ─────────────────────────────────────────────────────────────

describe("maskEmail", () => {
  it("returns null for falsy inputs", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
    expect(maskEmail("")).toBeNull();
  });

  it("masks the local part", () => {
    expect(maskEmail("antoine@example.com")).toBe("a***@example.com");
  });

  it("returns *** for malformed email", () => {
    expect(maskEmail("notanemail")).toBe("***");
  });
});

// ─── safeError ─────────────────────────────────────────────────────────────

describe("safeError", () => {
  it("extracts name and sanitized message from an Error", () => {
    const err = new Error("something\nwent wrong");
    const result = safeError(err);
    expect(result.name).toBe("Error");
    expect(result.message).toBe("something went wrong");
  });

  it("wraps a string error", () => {
    expect(safeError("boom")).toEqual({ message: "boom" });
  });

  it("returns unknown error for non-Error values", () => {
    expect(safeError(42)).toEqual({ message: "Unknown error" });
    expect(safeError(null)).toEqual({ message: "Unknown error" });
  });
});

// ─── redactScalar ──────────────────────────────────────────────────────────

describe("redactScalar", () => {
  it("redacts SENSITIVE_KEYWORDS regardless of value type", () => {
    expect(redactScalar("password", "secret")).toBe("[REDACTED]");
    expect(redactScalar("admin_token", "tok123")).toBe("[REDACTED]");
    expect(redactScalar("authorization", "Bearer xyz")).toBe("[REDACTED]");
    expect(redactScalar("cookie", "session=abc")).toBe("[REDACTED]");
    expect(redactScalar("resultjson", "{}")).toBe("[REDACTED]");
  });

  it("masks token fields", () => {
    const result = redactScalar("reportToken", "abcdefghij");
    expect(result).toBe("abcd…ghij");
  });

  it("masks email fields", () => {
    expect(redactScalar("userEmail", "user@example.com")).toBe("u***@example.com");
  });

  it("sanitizes URL fields", () => {
    expect(redactScalar("inputUrl", "https://example.com/path?q=1")).toBe("example.com/path");
  });

  it("sanitizes generic string values", () => {
    expect(redactScalar("reason", "something\nbad")).toBe("something bad");
  });

  it("passes through non-string, non-sensitive values unchanged", () => {
    expect(redactScalar("count", 42)).toBe(42);
    expect(redactScalar("flag", true)).toBe(true);
  });
});

// ─── redactDetails ─────────────────────────────────────────────────────────

describe("redactDetails", () => {
  it("passes through primitives unchanged", () => {
    expect(redactDetails(42)).toBe(42);
    expect(redactDetails(true)).toBe(true);
    expect(redactDetails(null)).toBeNull();
    expect(redactDetails(undefined)).toBeUndefined();
  });

  it("applies redactScalar to top-level strings", () => {
    expect(redactDetails("user@example.com", "email")).toBe("u***@example.com");
  });

  it("redacts sensitive keys in objects", () => {
    const result = redactDetails({ password: "secret", status: "ok" }) as Record<string, unknown>;
    expect(result.password).toBe("[REDACTED]");
    expect(result.status).toBe("ok");
  });

  it("applies maskToken to token string values", () => {
    const result = redactDetails({ reportToken: "abcdefghij" }) as Record<string, unknown>;
    expect(result.reportToken).toBe("abcd…ghij");
  });

  it("recurses into nested objects", () => {
    const result = redactDetails({
      meta: { inputUrl: "https://example.com/path?q=1", count: 3 },
    }) as Record<string, Record<string, unknown>>;
    expect(result.meta.inputUrl).toBe("example.com/path");
    expect(result.meta.count).toBe(3);
  });

  it("handles arrays", () => {
    const result = redactDetails([1, "hello\nbad", null]) as unknown[];
    expect(result[0]).toBe(1);
    expect(result[1]).toBe("hello bad");
    expect(result[2]).toBeNull();
  });

  it("handles circular references", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = redactDetails(obj) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.self).toBe("[Circular]");
  });

  it("does not apply redactScalar twice to string values in objects", () => {
    // sanitizeUrl("example.com") should be applied exactly once, not produce a double-sanitized artefact
    const result = redactDetails({ inputUrl: "https://example.com/path?secret=1" }) as Record<string, unknown>;
    expect(result.inputUrl).toBe("example.com/path");
  });
});
