"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { Language } from "@/lib/i18n/translations";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { language, setLanguage, languages, currentLanguageOption } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Compact corner trigger button showing small icon, short form, and chevron */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer select-none shadow-2xs ${
          isOpen
            ? "bg-[#EAF2FF] border-[#0B4EA2] text-[#0B4EA2] ring-2 ring-[#BFDBFE]"
            : "bg-white hover:bg-[#F8FAFC] border-[#CBD5E1] text-[#0F172A] hover:border-[#94A3B8]"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Change Language"
      >
        <Globe className="w-3.5 h-3.5 text-[#0B4EA2] shrink-0" />
        <span className="tracking-wide">{currentLanguageOption.shortLabel}</span>
        <ChevronDown
          className={`w-3 h-3 text-[#64748B] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#0B4EA2]" : ""
          }`}
        />
      </button>

      {/* Dropdown list of languages */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-[#E2E8F0] shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
          role="listbox"
        >
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] border-b border-[#F1F5F9] mb-1">
            Select Language
          </div>

          <div className="py-0.5 space-y-0.5">
            {languages.map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code as Language)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#EAF2FF] text-[#0B4EA2] font-bold"
                      : "text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A] font-medium"
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs">{lang.nativeLabel}</span>
                    <span className="text-[11px] text-[#64748B] font-normal">
                      ({lang.label})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? "bg-[#0B4EA2] text-white"
                          : "bg-[#F1F5F9] text-[#64748B]"
                      }`}
                    >
                      {lang.shortLabel}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#0B4EA2]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
