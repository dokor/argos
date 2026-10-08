"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import fr from "./fr.json";
import en from "./en.json";
import type { Lang } from "./routes";

export type { Lang } from "./routes";
export type Translations = typeof fr;
const translations: Record<Lang, Translations> = { fr, en: en as unknown as Translations };
type LangContextValue = { lang: Lang; setLang: (l: Lang) => void; t: Translations };
const LangContext = createContext<LangContextValue>({ lang: "fr", setLang: () => {}, t: fr });

// URL language is supplied before server rendering and hydration.
export function LangProvider({ children, initialLang = "fr" }: { children: React.ReactNode; initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  return <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>{children}</LangContext.Provider>;
}
export function useLang() { return useContext(LangContext); }
