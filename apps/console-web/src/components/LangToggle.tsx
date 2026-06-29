"use client";

import { useLang, Lang } from "@/lib/i18n/LangContext";
import s from "./LangToggle.module.scss";

type Props = {
  className?: string;
};

/**
 * Bouton de bascule FR ↔ EN.
 * Lit et écrit la langue via le LangContext (persisté dans localStorage).
 */
export default function LangToggle({ className }: Props) {
  const { lang, setLang, t } = useLang();

  function toggle() {
    const next: Lang = lang === "fr" ? "en" : "fr";
    setLang(next);
  }

  return (
    <button
      onClick={toggle}
      title={`Switch to ${lang === "fr" ? "English" : "Français"}`}
      className={`${s.btn}${className ? " " + className : ""}`}
    >
      {t.langToggle.label}
    </button>
  );
}
