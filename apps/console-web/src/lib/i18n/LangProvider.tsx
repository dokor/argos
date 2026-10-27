import type { ReactNode } from "react";
import fr from "./fr.json";
import en from "./en.json";
import { ClientLangProvider, type Lang } from "./LangContext";

export type { Lang, Translations } from "./LangContext";

// Server component: serialize only this route's dictionary, not both catalogs in client JS.
export function LangProvider({ children, initialLang = "fr" }: { children: ReactNode; initialLang?: Lang }) {
  return <ClientLangProvider initialLang={initialLang} translations={initialLang === "en" ? en : fr}>{children}</ClientLangProvider>;
}
