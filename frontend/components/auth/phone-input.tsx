"use client";

import React from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidIndianMobile } from "@/lib/validations/auth";
import { useLanguage } from "@/context/language-context";

interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
  disabled?: boolean;
  onEnterPress?: () => void;
  autoFocus?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  error,
  disabled = false,
  onEnterPress,
  autoFocus = true,
}: PhoneInputProps) {
  const { t } = useLanguage();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Retain only digits and cap at 10 digits
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(raw);
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnterPress && isValidIndianMobile(value)) {
      e.preventDefault();
      onEnterPress();
    }
  };

  const isValid = isValidIndianMobile(value);
  const isStarted = value.length > 0;

  return (
    <div className="w-full space-y-1.5 text-left">
      <label
        htmlFor="mobile-number-input"
        className="block text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
      >
        {t("authMobileLabel", "Mobile Number")} <span className="text-[#DC2626] dark:text-[#F87171]">*</span>
      </label>

      <div
        className={cn(
          "relative flex items-center w-full rounded-lg border bg-white dark:bg-[#111827] transition-all duration-150 focus-within:ring-2 focus-within:ring-offset-1 dark:focus-within:ring-offset-[#0B0F17]",
          disabled && "bg-[#F1F5F9] dark:bg-[#1E293B]/60 opacity-75 cursor-not-allowed",
          error
            ? "border-[#DC2626] dark:border-[#DC2626] focus-within:border-[#DC2626] focus-within:ring-[#FECACA] dark:focus-within:ring-[#DC2626]/30"
            : isValid
            ? "border-[#16A34A] dark:border-[#10B981] focus-within:border-[#16A34A] focus-within:ring-[#BBF7D0] dark:focus-within:ring-[#10B981]/30"
            : "border-[#CBD5E1] dark:border-[#2D3748] hover:border-[#94A3B8] dark:hover:border-[#4B5563] focus-within:border-[#0B4EA2] dark:focus-within:border-[#3B82F6] focus-within:ring-[#EAF2FF] dark:focus-within:ring-[#1E3A8A]/30"
        )}
      >
        {/* Country Code Prefix (+91 India) */}
        <div className="flex items-center gap-1.5 pl-3.5 pr-2.5 py-2.5 border-r border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30] rounded-l-lg select-none shrink-0">
          {/* India Flag mini icon / badge */}
          <span
            className="flex flex-col w-4 h-3 rounded-xs overflow-hidden border border-black/10 shadow-xs"
            title="India (+91)"
            aria-hidden="true"
          >
            <span className="w-full h-1/3 bg-[#FF9933]"></span>
            <span className="w-full h-1/3 bg-white flex items-center justify-center">
              <span className="w-0.5 h-0.5 rounded-full bg-[#000080]"></span>
            </span>
            <span className="w-full h-1/3 bg-[#138808]"></span>
          </span>
          <span className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            +91
          </span>
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          id="mobile-number-input"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          autoComplete="tel-national"
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="98765 43210"
          className="flex-1 h-11 px-3 text-base sm:text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] bg-transparent focus:outline-none"
        />

        {/* Action / Validation Indicator */}
        <div className="pr-3 flex items-center gap-1.5">
          {isStarted && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              aria-label="Clear mobile number"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {isValid ? (
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#34D399] shrink-0" />
          ) : isStarted && value.length === 10 ? (
            <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171] shrink-0" />
          ) : null}
        </div>
      </div>

      {/* Helper text or validation error */}
      {error ? (
        <p className="flex items-center gap-1 text-xs font-medium text-[#DC2626] dark:text-[#F87171] pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8] pt-0.5 px-0.5">
          <span>{t("authMobileHint", "Enter 10-digit number starting with 6-9")}</span>
          <span className={cn(value.length === 10 ? "text-[#16A34A] dark:text-[#34D399] font-semibold" : "")}>
            {value.length}/10
          </span>
        </div>
      )}
    </div>
  );
}
