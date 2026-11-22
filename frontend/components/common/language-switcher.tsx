"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { Language } from "@/lib/i18n/translations";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  showIcon?: boolean;
}

/**
 * LanguageSwitcher - Dropdown List Language Selector
 * Displays ONLY the selected language on the face of the button.
 * Clicking reveals the list of all language choices with active indicators.
 */
export function LanguageSwitcher({ className = "", showIcon = true }: LanguageSwitcherProps) {
  const { language, setLanguage, languages, currentLanguageOption } = useLanguage();
  const [, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code: Language) => {
    setIsOpen(false);
    if (code === language) return;
    startTransition(() => {
      setLanguage(code);
    });
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left shrink-0", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Language selector. Current language: ${currentLanguageOption.label}.`}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-semibold select-none transition-all cursor-pointer shadow-2xs",
          "border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30]",
          "text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]",
          "focus:outline-none focus:ring-2 focus:ring-[#0B4EA2]/25 dark:focus:ring-[#3B82F6]/30",
          isOpen && "ring-2 ring-[#0B4EA2]/30 dark:ring-[#3B82F6]/30 border-[#0B4EA2] dark:border-[#3B82F6]"
        )}
      >
        {showIcon && (
          <Globe className="w-3.5 h-3.5 text-[#0B4EA2] dark:text-[#60A5FA] shrink-0" />
        )}
        <span className="font-bold tracking-tight">
          <span className="hidden sm:inline">{currentLanguageOption.nativeLabel}</span>
          <span className="inline sm:hidden">{currentLanguageOption.shortLabel}</span>
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Language choices"
          className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] w-auto rounded-xl border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#1E293B] mb-1">
            Language / भाषा
          </div>
          <div className="space-y-0.5">
            {languages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(lang.code as Language)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left",
                    isSelected
                      ? "bg-[#EAF2FF] dark:bg-[#1E3A8A]/40 text-[#0B4EA2] dark:text-[#93C5FD] font-bold"
                      : "text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-white font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs">{lang.nativeLabel}</span>
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                      ({lang.label})
                    </span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#0B4EA2] dark:text-[#60A5FA] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
