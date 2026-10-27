import { clearPendingAnalysis } from "./connected/analysis-recovery";
export type AccountProfile = { displayName: string; email: string | null; verified: boolean; admin?: boolean };
export type SignInMethod = { id: string; provider: string; usable: boolean };
let csrf: string | null = null;
export function resetAccountCsrf() { csrf = null; }
let renewal: Promise<boolean> | null = null;
let renewAfter = 0;
const RENEW_INTERVAL = 10 * 60 * 1000;
export class AccountClientError extends Error { constructor(public code: string, public status: number, public retryAfter = 0) { super(code); } }
async function csrfToken(signal?: AbortSignal): Promise<string> {
  if (csrf) return csrf;
  const response = await fetch("/api/account/csrf", { cache: "no-store", ...(signal ? {signal,redirect:"error" as const} : {}) });
  if (!response.ok) throw new AccountClientError("account_unavailable", response.status);
  csrf = (await response.json()).csrf;
  return csrf!;
}
export async function accountFetch<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal, idempotencyKey?: string, captcha?: string): Promise<T> {
  const authenticated = path !== "session" && (!path.startsWith("auth/") || ["auth/logout", "auth/reauth", "auth/confirm-email"].includes(path));
  if (authenticated && typeof window !== "undefined") await renewAccountSession();
  signal?.throwIfAborted();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers["Accept-Language"] = typeof window !== "undefined" && window.location.pathname.startsWith("/en/") ? "en" : "fr";
  if (captcha) headers["X-Argos-Captcha"] = captcha;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (method !== "GET") headers["X-Argos-CSRF"] = await csrfToken();
  const response = await fetch("/api/account/" + path, { method, headers, signal, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 403 && data.error === "csrf_invalid") csrf = null; if (response.status === 401 && typeof window !== "undefined" && path !== "me" && path !== "auth/login") window.dispatchEvent(new Event("argos-account-invalid")); throw new AccountClientError(path === "auth/login" && response.status === 401 ? "credentials_invalid" : data.error ?? (response.status === 429 ? "rate_limited" : response.status === 401 ? "session_invalid" : "account_unavailable"), response.status, Number(response.headers.get("retry-after")) || 0); }
  if (["auth/login","auth/verify"].includes(path) && typeof window !== "undefined") { renewAfter = 0; window.dispatchEvent(new Event("argos-account-login")); }
  if (["auth/logout","auth/reset","me/archive"].includes(path) && typeof window !== "undefined") {renewAfter = 0;clearPendingAnalysis();window.dispatchEvent(new Event("argos-account-invalid"));}
  if (/^runs\/\d+\/claim$/.test(path) && typeof window !== "undefined") window.dispatchEvent(new Event("argos-usage-refresh"));
  return data as T;
}

/** Coalesce renewal before private requests, including the first request after sleep or reload. */
export async function renewAccountSession(): Promise<boolean> {
  if (renewal) return renewal;
  if (Date.now() < renewAfter) return false;
  renewal = accountFetch<{ accepted: boolean }>("auth/renew", "POST", {})
    .then(data => { renewAfter = Date.now() + RENEW_INTERVAL; return data.accepted; })
    .catch(reason => {
      // Outages stay retryable; throttle rejected sessions while allowing login in another tab.
      if (reason instanceof AccountClientError && reason.status === 401) renewAfter = Date.now() + RENEW_INTERVAL;
      throw reason;
    })
    .finally(() => { renewal = null; });
  return renewal;
}

export async function accountAuditHeaders(signal?: AbortSignal): Promise<Record<string,string>> {
  await renewAccountSession();
  signal?.throwIfAborted();
  return { "X-Argos-CSRF": await csrfToken(signal) };
}
