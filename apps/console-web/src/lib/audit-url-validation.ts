// Only http and https are accepted.
const ALLOWED_SCHEMES = /^https?:\/\//i;

// Hostnames that map to internal/private resources.
const BLOCKED_HOSTNAME = /^(localhost|.*\.local|.*\.internal|.*\.localhost|.*\.localdomain)$/i;

// Private IPv4 ranges (loopback, link-local, RFC-1918, AWS metadata).
const PRIVATE_IPV4 =
  /^(127\.|169\.254\.|10\.|172\.(1[6-9]|2[0-9]|30|31)\.|192\.168\.|0\.0\.0\.0)/;

// Private/loopback IPv6.
const PRIVATE_IPV6 = /^(::1$|::$|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:|fe80:)/i;

/**
 * Returns an error message if the URL targets a private/internal resource,
 * or null if it looks safe.
 */
export function ssrfError(raw: string): string | null {
  let parsed: URL;
  try {
    // Prepend https:// when the user omitted the scheme (same logic as backend).
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(raw)
      ? raw
      : `https://${raw}`;
    parsed = new URL(withScheme);
  } catch {
    return "Invalid URL format";
  }

  const scheme = parsed.protocol.replace(/:$/, "");
  if (!ALLOWED_SCHEMES.test(parsed.href)) {
    return `Scheme '${scheme}' is not allowed - only http and https are accepted`;
  }

  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAME.test(host)) {
    return "Internal or local hostnames are not allowed";
  }

  if (PRIVATE_IPV4.test(host)) {
    return "Private IPv4 addresses are not allowed";
  }

  // IPv6 literals are wrapped in brackets by the URL parser; strip them.
  const bare = host.startsWith("[") ? host.slice(1, -1) : host;
  if (PRIVATE_IPV6.test(bare)) {
    return "Private IPv6 addresses are not allowed";
  }

  return null;
}
