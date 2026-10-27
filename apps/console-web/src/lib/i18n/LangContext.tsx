"use client";

import React, { createContext, useContext, useEffect } from "react";
import type fr from "./fr.json";
import type { Lang } from "./routes";

export type { Lang } from "./routes";
export type Translations = typeof fr;
type LangContextValue = { lang: Lang; t: Translations };
export const LangContext = createContext<LangContextValue | null>(null);

// URL language is supplied before server rendering and hydration.
export function ClientLangProvider({ children, initialLang, translations }: { children: React.ReactNode; initialLang: Lang; translations: Translations }) {
  useEffect(() => { document.documentElement.lang = initialLang; }, [initialLang]);
  return <LangContext.Provider value={{ lang: initialLang, t: translations }}>{children}</LangContext.Provider>;
}
export function useLang() {
  const value = useContext(LangContext);
  if (!value) throw new Error("useLang requires LangProvider");
  return value;
}
