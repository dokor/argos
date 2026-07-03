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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Valeur initiale "light" côté SSR ; hydratée après montage (SSR-safe, cf. LangContext).
  const [theme, setThemeState] = useState<Theme>("light");

  // Hydrate l'état React depuis le thème déjà appliqué par le script anti-FOUC
  // (data-theme), sinon le choix persistant / la préférence système.
  // setState différé (setTimeout) pour ne pas déclencher react-hooks/set-state-in-effect,
  // même pattern que LangContext.
  useEffect(() => {
    let initial: Theme = "light";
    try {
      const attr = document.documentElement.getAttribute("data-theme");
      const stored = localStorage.getItem(STORAGE_KEY);
      if (attr === "dark" || attr === "light") {
        initial = attr;
      } else if (stored === "dark" || stored === "light") {
        initial = stored;
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        initial = "dark";
      }
    } catch {
      // localStorage indisponible : on reste en clair.
    }
    applyTheme(initial);
    const timerId = window.setTimeout(() => setThemeState(initial), 0);
    return () => window.clearTimeout(timerId);
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
