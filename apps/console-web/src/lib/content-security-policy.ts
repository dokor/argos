/** Scripts need a per-response nonce; inline styles remain necessary for React styles. */
export function contentSecurityPolicy(nonce: string, development = false): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com${development ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    "frame-src 'self' https://challenges.cloudflare.com",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
