"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import fr from "./fr.json";
import en from "./en.json";

export type Lang = "fr" | "en";
export type Translations = typeof fr;

const STORAGE_KEY = "argos-lang";

const translations: Record<Lang, Translations> = { fr, en: en as unknown as Translations };

type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
};

const LangContext = createContext<LangContextValue>({
  lang: "fr",
  setLang: () => {},
  t: fr,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  // Hydrate depuis le localStorage après le premier rendu (SSR-safe)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") {
      const timerId = window.setTimeout(() => setLangState(stored), 0);
      return () => window.clearTimeout(timerId);
    }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

/** Hook principal : retourne { lang, setLang, t } */
export function useLang() {
  return useContext(LangContext);
}
