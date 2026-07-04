"use client";

import { useTheme } from "@/lib/theme/ThemeContext";
import s from "./ThemeToggle.module.scss";

/**
 * Bascule clair/sombre (issue #81). Persiste le choix et respecte
 * `prefers-color-scheme` par défaut (voir ThemeContext).
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`${s.toggle}${className ? " " + className : ""}`}
      aria-pressed={isDark}
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
    >
      <span aria-hidden="true">{isDark ? "☀︎" : "☾"}</span>
    </button>
  );
}
