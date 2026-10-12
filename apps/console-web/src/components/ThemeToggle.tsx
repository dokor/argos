"use client";

import { useLang } from "@/lib/i18n/LangContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import s from "./ThemeToggle.module.scss";

/**
 * Bascule clair/sombre (issue #81). Persiste le choix et respecte
 * `prefers-color-scheme` par défaut (voir ThemeContext).
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const { t } = useLang();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${s.toggle}${className ? " " + className : ""}`}
      aria-pressed={isDark}
      aria-label={isDark ? t.themeToggle.light : t.themeToggle.dark}
      title={isDark ? t.themeToggle.lightTitle : t.themeToggle.darkTitle}
    >
      <span aria-hidden="true">{isDark ? "☀︎" : "☾"}</span>
    </button>
  );
}
