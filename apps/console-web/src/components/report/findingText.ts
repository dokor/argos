/** Treat tool prose as bounded plain text, including historical reports. */
export function cleanEvidence(text?: string | null): string {
  return (text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/https?:\/\/[^\s<>"}\]]+/g, value => {
      try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString(); }
      catch { return '[URL]'; }
    }).replace(/\/(report|share)\/[A-Za-z0-9_-]{20,512}/g, '/$1/[redacted]')
    .replace(/\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=][^\r\n]*/gi, '$1=[redacted]')
    .replace(/\b(password|secret|token|api[_-]?key)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;<>]+)/gi, '$1=[redacted]').slice(0, 4000);
}
