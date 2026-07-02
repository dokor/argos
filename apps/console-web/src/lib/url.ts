/**
 * URL input helpers shared by the public landing form and the dashboard form.
 *
 * The audit input must accept URLs typed with or without a protocol
 * (`example.com`, `http://example.com`, `https://example.com`). The BFF
 * (`/api/audits`) and the Java backend (`UrlNormalizer`) already prepend
 * `https://` when the scheme is missing, so we mirror that rule client-side
 * instead of relying on the browser's native `type="url"` validation, which
 * rejects scheme-less input before the form can submit.
 */

// Detects any RFC-3986 scheme prefix (e.g. `http://`, `https://`, `ftp://`),
// matching the detection used by the BFF and the backend. A non-http(s) scheme
// is left untouched so the backend can reject it with a clear message rather
// than us producing a mangled `https://ftp://…`.
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

/** Returns true if the raw input already starts with an explicit scheme. */
export function hasUrlScheme(raw: string): boolean {
  return HAS_SCHEME.test(raw.trim());
}

/**
 * Normalizes a user-typed URL for submission: trims it and prepends `https://`
 * when no protocol is present. Returns an empty string for blank input.
 */
export function normalizeInputUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
}
