export const locales = [
  { code: "fr", name: "Français", region: "fr_FR" },
  { code: "en", name: "English", region: "en_GB" },
  { code: "de", name: "Deutsch", region: "de_DE" },
  { code: "es", name: "Español", region: "es_ES" },
  { code: "it", name: "Italiano", region: "it_IT" },
  { code: "nl", name: "Nederlands", region: "nl_NL" },
  { code: "pt", name: "Português", region: "pt_PT" },
  { code: "pl", name: "Polski", region: "pl_PL" },
  { code: "sv", name: "Svenska", region: "sv_SE" },
  { code: "da", name: "Dansk", region: "da_DK" },
  { code: "fi", name: "Suomi", region: "fi_FI" },
  { code: "cs", name: "Čeština", region: "cs_CZ" },
  { code: "sk", name: "Slovenčina", region: "sk_SK" },
  { code: "hu", name: "Magyar", region: "hu_HU" },
  { code: "ro", name: "Română", region: "ro_RO" },
  { code: "bg", name: "Български", region: "bg_BG" },
  { code: "el", name: "Ελληνικά", region: "el_GR" },
  { code: "hr", name: "Hrvatski", region: "hr_HR" },
  { code: "sl", name: "Slovenščina", region: "sl_SI" },
  { code: "lt", name: "Lietuvių", region: "lt_LT" },
  { code: "lv", name: "Latviešu", region: "lv_LV" },
  { code: "et", name: "Eesti", region: "et_EE" },
] as const;

export type Lang = (typeof locales)[number]["code"];
export type SourceLang = "fr" | "en";
export function intlLocale(lang: Lang): string {
  return locales.find(locale => locale.code === lang)!.region.replace("_", "-");
}
export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && locales.some(locale => locale.code === value);
}
export function languageFromPath(path: string): Lang {
  const prefix = path.split(/[/?#]/)[1];
  return isLang(prefix) ? prefix : "fr";
}
export function languageFromHeader(header: string | null): Lang {
  const candidates = (header ?? "").split(",").map((part, order) => {
    const [tag, ...parameters] = part.trim().split(";");
    const quality = parameters.find(value => value.trim().startsWith("q="));
    return { code: tag.toLowerCase().split("-")[0], quality: quality ? Number(quality.trim().slice(2)) : 1, order };
  }).filter(value => Number.isFinite(value.quality) && value.quality > 0 && value.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.order - b.order);
  return candidates.find(value => isLang(value.code))?.code as Lang ?? "fr";
}
