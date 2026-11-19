import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { isLang, locales, type Lang } from "./locales";
import { installMessages, type Messages } from "./messages";
import { localizeValue } from "./messages";
import { localizedPath } from "./routes";
import { siteUrl } from "./metadata";
import type { Metadata } from "next";

export const loadMessages = cache(async (lang: Lang): Promise<Messages> => {
  if (!isLang(lang)) throw new Error("Unsupported translation catalogue");
  const messages: Messages = lang === "fr" ? {} : (await import(`./catalogues/${lang}.json`)).default;
  installMessages(lang, messages);
  return messages;
});

export async function requestLanguage(): Promise<Lang> {
  const value = (await headers()).get("x-argos-language") ?? "en";
  const lang = isLang(value) ? value : "fr";
  await loadMessages(lang);
  return lang;
}

export async function requestMetadata(metadata: Metadata): Promise<Metadata> {
  const lang = await requestLanguage();
  const result = { ...metadata, title: localizeValue(metadata.title, lang), description: localizeValue(metadata.description, lang),
    keywords: localizeValue(metadata.keywords, lang),
    ...(metadata.openGraph ? { openGraph: { ...metadata.openGraph, title: localizeValue(metadata.openGraph.title, lang), description: localizeValue(metadata.openGraph.description, lang) } } : {}),
    ...(metadata.twitter ? { twitter: { ...metadata.twitter, title: localizeValue(metadata.twitter.title, lang), description: localizeValue(metadata.twitter.description, lang) } } : {}),
  };
  const url = (value: unknown) => typeof value === "string" && value.startsWith(siteUrl)
    ? siteUrl + localizedPath(value.slice(siteUrl.length) || "/", lang) : value;
  return {
    ...result,
    ...(result.alternates ? { alternates: { ...result.alternates, canonical: url(result.alternates.canonical) as string | null | undefined } } : {}),
    ...(result.openGraph ? { openGraph: { ...result.openGraph, locale: locales.find(locale => locale.code === lang)!.region,
      alternateLocale: locales.filter(locale => locale.code !== lang).map(locale => locale.region),
      url: url(result.openGraph.url) as string | undefined } } : {}),
  };
}
