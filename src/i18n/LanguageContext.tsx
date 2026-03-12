import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import en from "./translations/en.json";
import he from "./translations/he.json";

export type Language = "en" | "he";
export type Direction = "ltr" | "rtl";

interface LanguageContextType {
  language: Language;
  direction: Direction;
  t: (key: string) => string;
  setLanguage: (lang: Language) => void;
}

const translations: Record<Language, Record<string, any>> = { en, he };

function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((acc, part) => acc?.[part], obj) ?? path;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("rental-copilot-lang");
    return (stored === "he" || stored === "en") ? stored : "en";
  });

  const direction: Direction = language === "he" ? "rtl" : "ltr";

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("rental-copilot-lang", lang);
  }, []);

  const t = useCallback(
    (key: string) => getNestedValue(translations[language], key),
    [language]
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  return (
    <LanguageContext.Provider value={{ language, direction, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
