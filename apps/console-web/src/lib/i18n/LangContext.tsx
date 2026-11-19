"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import fr from "./fr.json";
import en from "./en.json";
import type { Lang } from "./routes";
import { installMessages, localizeValue, type Messages } from "./messages";

export type { Lang } from "./routes";
export type Translations = typeof fr;
type LangContextValue = { lang: Lang; setLang: (l: Lang) => void; t: Translations };
const LangContext = createContext<LangContextValue>({ lang: "fr", setLang: () => {}, t: fr });

// URL language is supplied before server rendering and hydration.
export function LangProvider({ children, initialLang = "fr", messages = {} }: { children: React.ReactNode; initialLang?: Lang; messages?: Messages }) {
  installMessages(initialLang, messages);
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const t = lang === "fr" ? fr : localizeValue(en, lang) as unknown as Translations;
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}
export function useLang() { return useContext(LangContext); }
