import { analysisUrl } from './audit-url-policy.mjs';

/** Admission syntax/IP policy; Java checks DNS and the egress proxy pins the connection. */
export function ssrfError(raw: string): string | null {
  try {
    analysisUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    return null;
  } catch { return "Invalid or non-public audit URL"; }
}
