import type { Lang } from "./i18n/routes";

/** A renewal always uses its billing timezone, independent of the viewer's browser. */
export function quotaResetDate(value: string, lang: Lang, timezone = "UTC"): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short", timeZone: timezone };
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", options); }
  catch { timezone = "UTC"; formatter = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { ...options, timeZone: timezone }); }
  const date = new Date(value);
  return `${Number.isFinite(date.getTime()) ? formatter.format(date) : "—"} · ${timezone}`;
}
