/**
 * Pure sanitisation helpers for structured logging.
 *
 * No side-effects, no I/O, no environment access — safe to unit-test directly.
 * `logger.ts` depends on this module; nothing else in the app should need to
 * import it directly (use the re-exports from `logger.ts` instead).
 */

type LogDetails = Record<string, unknown>;

/** Keys whose values must always be fully redacted, regardless of type. */
export const SENSITIVE_KEYWORDS = [
  "admin_token",
  "authorization",
  "cookie",
  "password",
  "resultjson",
] as const;

// ─── Scalar sanitisers ─────────────────────────────────────────────────────

/** Strips control characters and caps length for safe log output. */
export function sanitizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[\r\n\t]/g, " ").slice(0, 200);
}

/**
 * Returns only `host + pathname` of a URL, dropping query-string and fragment
 * to avoid leaking sensitive parameters.
 */
export function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(raw)
      ? raw
      : `https://${raw}`;
    const url = new URL(withScheme);
    return `${url.host}${url.pathname}`;
  } catch {
    const withoutQuery = raw.replace(/[?#].*$/, "");
    return sanitizeText(withoutQuery);
  }
}

/** Masks all but the first and last 4 characters of a token. */
export function maskToken(token: string | number | null | undefined): string | null {
  if (token === null || token === undefined) return null;

  const s = String(token);
  return s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/** Masks the local part of an email address: `user@example.com` → `u***@example.com`. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";

  return `${localPart[0]}***@${domain}`;
}

/** Extracts a safe `{ name, message }` object from any thrown value. */
export function safeError(error: unknown): LogDetails {
  if (error instanceof Error) {
    return { message: sanitizeText(error.message), name: error.name };
  }
  if (typeof error === "string") {
    return { message: sanitizeText(error) };
  }
  return { message: "Unknown error" };
}

// ─── Recursive redaction ───────────────────────────────────────────────────

/**
 * Applies key-based masking to a scalar value.
 * For object values the caller should recurse with `redactDetails` instead.
 */
export function redactScalar(key: string, value: unknown): unknown {
  const k = key.toLowerCase();

  if (SENSITIVE_KEYWORDS.some((kw) => k.includes(kw))) return "[REDACTED]";
  if (k.includes("token"))  return maskToken(typeof value === "string" || typeof value === "number" ? value : null);
  if (k.includes("email"))  return maskEmail(typeof value === "string" ? value : null);
  if (k.includes("url"))    return sanitizeUrl(typeof value === "string" ? value : null);
  if (typeof value === "string") return sanitizeText(value);

  return value;
}

/**
 * Recursively redacts a log-details tree:
 * - Sensitive parent keys → `"[REDACTED]"` (whole subtree)
 * - String leaves → `redactScalar` (once)
 * - Circular references → `"[Circular]"`
 */
export function redactDetails(value: unknown, key = "", seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") return redactScalar(key, value);

  if (Array.isArray(value)) return value.map((item) => redactDetails(item, key, seen));

  if (typeof value !== "object") return String(value);

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  const entries = Object.entries(value).map(([k, v]) => {
    const normalized = k.toLowerCase();
    if (SENSITIVE_KEYWORDS.some((kw) => normalized.includes(kw))) {
      return [k, "[REDACTED]"];
    }
    return [k, redactDetails(v, k, seen)];
  });

  return Object.fromEntries(entries);
}
