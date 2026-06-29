"use client";

import { useLang, Lang } from "@/lib/i18n/LangContext";

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
      className={className}
      style={{
        background: "none",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "5px 10px",
        fontSize: 12,
        cursor: "pointer",
        color: "#64748b",
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {t.langToggle.label}
    </button>
  );
}
