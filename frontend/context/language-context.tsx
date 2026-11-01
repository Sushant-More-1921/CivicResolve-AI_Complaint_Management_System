"use client";

import React, { createContext, useContext, useState, useEffect, useTransition } from "react";
import {
  Language,
  LANGUAGES,
  LanguageOption,
  translations,
  TranslationKey,
} from "@/lib/i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string, fallback?: string) => string;
  languages: LanguageOption[];
  currentLanguageOption: LanguageOption;
  isPending: boolean;
}

const STORAGE_KEY = "civicresolve_lang";

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isPending, startTransition] = useTransition();

  // Load language preference on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (stored && (stored === "en" || stored === "hi" || stored === "mr")) {
        setLanguageState(stored);
        document.documentElement.lang = stored;
      } else {
        document.documentElement.lang = "en";
      }
    } catch {
      // localStorage may fail in private mode/SSR
    }
  }, []);

  const setLanguage = (lang: Language) => {
    startTransition(() => {
      setLanguageState(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.lang = lang;
      } catch {
        // Ignore storage write errors
      }
    });
  };

  const t = (key: TranslationKey | string, fallback?: string): string => {
    const langDict = translations[language] as Record<string, string>;
    if (langDict && key in langDict) {
      return langDict[key];
    }
    // Fallback to English
    const enDict = translations.en as Record<string, string>;
    if (enDict && key in enDict) {
      return enDict[key];
    }
    return fallback !== undefined ? fallback : String(key);
  };

  const currentLanguageOption =
    LANGUAGES.find((opt) => opt.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: LANGUAGES,
        currentLanguageOption,
        isPending,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Provide a safe fallback if accessed outside Provider
    return {
      language: "en" as Language,
      setLanguage: () => {},
      t: (key: TranslationKey | string, fallback?: string) =>
        fallback !== undefined ? fallback : String(key),
      languages: LANGUAGES,
      currentLanguageOption: LANGUAGES[0],
      isPending: false,
    };
  }
  return context;
}
