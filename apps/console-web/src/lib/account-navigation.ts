import { safeAccountReturn } from "./account-return";
import { localizedPath, type Lang } from "./i18n/routes";

/** Localize only an allowlisted destination, including its permitted back link. */
export function localizedAccountReturn(raw: unknown, lang: Lang): string {
  const safe = safeAccountReturn(raw);
  const url = new URL(safe, "https://argos.invalid");
  if (url.searchParams.has("returnTo")) {
    url.searchParams.set("returnTo", localizedAccountReturn(url.searchParams.get("returnTo"), lang));
    return safeAccountReturn(localizedPath(url.pathname + url.search, lang));
  }
  return safeAccountReturn(localizedPath(safe, lang));
}

export type AuthLanguageContext = { returnTo?: string; token: string };

export function authLanguagePath(path: string, lang: Lang, context: AuthLanguageContext): string {
  const url = new URL(localizedPath(path, lang), "https://argos.invalid");
  if (context.returnTo !== undefined || url.searchParams.has("returnTo"))
    url.searchParams.set("returnTo", localizedAccountReturn(context.returnTo ?? url.searchParams.get("returnTo"), lang));
  // Tokens remain fragment-only. Use the live form state after the address bar was scrubbed.
  url.hash = context.token ? new URLSearchParams({ token: context.token }).toString() : "";
  return url.pathname + url.search + url.hash;
}
