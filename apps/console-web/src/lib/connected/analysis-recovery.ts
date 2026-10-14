export type PendingAnalysis = { url: string; profileId: string; key: string };
const storageKey = "argos.pending-analysis";

// Per-tab recovery only, read after hydration. No session or report credential is persisted.
export function pendingAnalysis(): PendingAnalysis | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value.url === "string" && value.url.length <= 2048 &&
        typeof value.profileId === "string" && /^[a-z0-9-]{1,64}$/.test(value.profileId) &&
        typeof value.key === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.key))
      return { url: value.url, profileId: value.profileId, key: value.key };
  } catch { /* Corrupt recovery data cannot be an admission request. */ }
  sessionStorage.removeItem(storageKey);
  return null;
}
export function rememberAnalysis(value: PendingAnalysis) { sessionStorage.setItem(storageKey, JSON.stringify(value)); }
export function clearPendingAnalysis() {
  try { sessionStorage.removeItem(storageKey); } catch { /* Cleanup must not prevent logout. */ }
}
export function forgetAnalysis(key: string) {
  if (pendingAnalysis()?.key === key) sessionStorage.removeItem(storageKey);
}
