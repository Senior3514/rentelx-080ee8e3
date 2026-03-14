import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type ColorScheme = "default" | "ocean" | "sunset" | "emerald" | "midnight";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  colorScheme: ColorScheme;
  setTheme: (theme: Theme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_THEMES: Theme[] = ["light", "dark", "system"];
const VALID_SCHEMES: ColorScheme[] = ["default", "ocean", "sunset", "emerald", "midnight"];

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("rentelx-theme");
    return VALID_THEMES.includes(stored as Theme) ? stored as Theme : "system";
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const stored = localStorage.getItem("rentelx-color-scheme");
    return VALID_SCHEMES.includes(stored as ColorScheme) ? stored as ColorScheme : "default";
  });

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("rentelx-theme", t);
  }, []);

  const setColorScheme = useCallback((s: ColorScheme) => {
    setColorSchemeState(s);
    localStorage.setItem("rentelx-color-scheme", s);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", resolvedTheme === "dark");
    // Remove all scheme classes, then add current one
    VALID_SCHEMES.forEach(s => html.classList.remove(`scheme-${s}`));
    if (colorScheme !== "default") {
      html.classList.add(`scheme-${colorScheme}`);
    }
  }, [resolvedTheme, colorScheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setThemeState("system"); // triggers re-render
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, colorScheme, setColorScheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
