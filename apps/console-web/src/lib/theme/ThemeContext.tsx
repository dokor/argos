"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "argos-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Choix explicite persisté, ou null si l'utilisateur suit la préférence système. */
function storedChoice(): Theme | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s === "dark" || s === "light" ? s : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Valeur initiale "light" côté SSR ; hydratée après montage (SSR-safe, cf. LangContext).
  const [theme, setThemeState] = useState<Theme>("light");

  // Hydrate depuis le choix explicite persisté, sinon la préférence système —
  // identique au script anti-FOUC, donc pas de flash. setState différé
  // (setTimeout) pour éviter react-hooks/set-state-in-effect (cf. LangContext).
  useEffect(() => {
    const initial = storedChoice() ?? systemTheme();
    applyTheme(initial);
    const timerId = window.setTimeout(() => setThemeState(initial), 0);

    // Réactivité live : tant qu'aucun choix explicite n'a été fait, on suit les
    // changements de thème de l'OS pendant que la page est ouverte.
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (storedChoice()) return; // un choix explicite l'emporte sur le système
      const next = systemTheme();
      applyTheme(next);
      setThemeState(next);
    };
    mql?.addEventListener("change", onSystemChange);

    return () => {
      window.clearTimeout(timerId);
      mql?.removeEventListener("change", onSystemChange);
    };
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
