import { clearPendingAnalysis } from "./connected/analysis-recovery";
export type AccountProfile = { displayName: string; email: string | null; verified: boolean; admin?: boolean };
let csrf: string | null = null;
export class AccountClientError extends Error { constructor(public code: string, public status: number, public retryAfter = 0) { super(code); } }
async function csrfToken(): Promise<string> {
  if (csrf) return csrf;
  const response = await fetch("/api/account/csrf", { cache: "no-store" });
  if (!response.ok) throw new AccountClientError("account_unavailable", response.status);
  csrf = (await response.json()).csrf;
  return csrf!;
}
export async function accountFetch<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (method !== "GET") headers["X-Argos-CSRF"] = await csrfToken();
  const response = await fetch("/api/account/" + path, { method, headers, signal, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 403 && data.error === "csrf_invalid") csrf = null; if (response.status === 401 && typeof window !== "undefined" && path !== "me" && path !== "auth/login") window.dispatchEvent(new Event("argos-account-invalid")); throw new AccountClientError(path === "auth/login" && response.status === 401 ? "credentials_invalid" : data.error ?? (response.status === 429 ? "rate_limited" : response.status === 401 ? "session_invalid" : "account_unavailable"), response.status, Number(response.headers.get("retry-after")) || 0); }
  if (["auth/login","auth/verify"].includes(path) && typeof window !== "undefined") window.dispatchEvent(new Event("argos-account-login"));
  if (["auth/logout","me/archive"].includes(path) && typeof window !== "undefined") {clearPendingAnalysis();window.dispatchEvent(new Event("argos-account-invalid"));}
  if (/^runs\/\d+\/claim$/.test(path) && typeof window !== "undefined") window.dispatchEvent(new Event("argos-usage-refresh"));
  return data as T;
}
export async function accountAuditHeaders(): Promise<Record<string,string>> {
  return { "X-Argos-CSRF": await csrfToken() };
}
