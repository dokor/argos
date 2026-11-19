import { cloneElement, isValidElement, type ReactElement } from "react";
import { localizedPath } from "./routes";
import { intlLocale, type Lang } from "./locales";

export type Messages = Readonly<Record<string, string>>;
// Each entry is immutable and keyed by its language: concurrent SSR requests never
// change another request's locale. Only the current catalogue is sent to the client.
const catalogues = new Map<Lang, Messages>();
const values = new WeakMap<object, Map<Lang, unknown>>();

export function installMessages(lang: Lang, messages: Messages): void {
  if (!catalogues.has(lang) || Object.keys(catalogues.get(lang)!).length === 0) catalogues.set(lang, Object.freeze(messages));
}

export function translateText(text: string, lang: Lang): string {
  if (lang === "fr") return text;
  const messages = catalogues.get(lang);
  if (!messages) {
    if (lang === "en") return text;
    throw new Error(`Missing translation catalogue: ${lang}`);
  }
  if (Object.hasOwn(messages, text)) return messages[text];
  // JSX indentation is not part of the translation, but intentional surrounding
  // whitespace (including spaces between inline elements) must survive.
  const trimmed = text.trim();
  return Object.hasOwn(messages, trimmed) ? text.replace(trimmed, () => messages[trimmed]) : text;
}

/** Localize authored copy only. Never pass measured evidence or user content here. */
export function localizeValue<T>(value: T, lang: Lang): T {
  if (lang === "fr" || value == null) return value;
  if (typeof value === "string") {
    return (value.startsWith("/") && !value.startsWith("//") ? localizedPath(value, lang) : translateText(value, lang)) as T;
  }
  if (typeof value !== "object") return value;
  const cached = values.get(value)?.get(lang);
  if (cached !== undefined) return cached as T;
  let result: unknown;
  if (isValidElement(value)) {
    const element = value as ReactElement<Record<string, unknown>>;
    if (element.type === "code" || element.type === "pre") return value;
    const props: Record<string, unknown> = {};
    for (const key of ["children", "title", "aria-label", "alt", "placeholder", "href"])
      if (key in element.props) props[key] = localizeValue(element.props[key], lang);
    result = cloneElement(element, props);
  } else if (Array.isArray(value)) {
    result = value.map(item => localizeValue(item, lang));
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
    result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      // Code samples, IDs, source citations and external URLs retain their meaning.
      key === "locale" ? intlLocale(lang) : ["code", "id", "key", "keys", "route", "englishRoute", "path", "slug", "sourceUrl", "verifiedAt", "dateTime", "@context", "@type", "inLanguage"].includes(key)
        ? item : localizeValue(item, lang)]));
  }
  const cache = values.get(value) ?? new Map<Lang, unknown>();
  cache.set(lang, result); values.set(value, cache);
  return result as T;
}

export function localizedCopy<T extends { fr: unknown; en: unknown }>(copy: T, lang: Lang): T["fr"] | T["en"] {
  return lang === "fr" ? copy.fr : localizeValue(copy.en, lang);
}
