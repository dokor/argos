export type AccountProfile = { displayName: string; email: string | null; verified: boolean };
let csrf: string | null = null;
export class AccountClientError extends Error { constructor(public code: string, public status: number) { super(code); } }
async function csrfToken(): Promise<string> {
  if (csrf) return csrf;
  const response = await fetch("/api/account/csrf", { cache: "no-store" });
  if (!response.ok) throw new AccountClientError("account_unavailable", response.status);
  csrf = (await response.json()).csrf;
  return csrf!;
}
export async function accountFetch<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (method !== "GET") headers["X-Argos-CSRF"] = await csrfToken();
  const response = await fetch("/api/account/" + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 403 && data.error === "csrf_invalid") csrf = null; throw new AccountClientError(data.error ?? (response.status === 429 ? "rate_limited" : response.status === 401 ? "session_invalid" : "account_unavailable"), response.status); }
  return data as T;
}
export async function accountAuditHeaders(): Promise<Record<string,string>> {
  return { "X-Argos-CSRF": await csrfToken() };
}
