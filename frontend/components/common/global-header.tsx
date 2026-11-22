"use client";

import React from "react";
import Link from "next/link";
import { CivicResolveLogo } from "@/components/common/civic-logo";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { cn } from "@/lib/utils";

export interface GlobalHeaderProps {
  subtitle?: string | React.ReactNode;
  logoHref?: string | null;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  showLanguageSwitcher?: boolean;
  showThemeToggle?: boolean;
  maxWidthClassName?: string;
  className?: string;
}

/**
 * Standardized CivicResolve Global Header
 * Ensures 100% consistent logo placement, proportions, height, borders, and navigation.
 */
export function GlobalHeader({
  subtitle,
  logoHref = "/",
  actions,
  children,
  showLanguageSwitcher = true,
  showThemeToggle = true,
  maxWidthClassName = "max-w-6xl",
  className,
}: GlobalHeaderProps) {
  return (
    <header
      className={cn(
        "w-full bg-white dark:bg-[#0D131F] border-b border-[#E2E8F0] dark:border-[#1E293B] sticky top-0 z-40 shadow-xs transition-colors",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3",
          maxWidthClassName
        )}
      >
        {/* Left: Official CivicResolve Logo */}
        <div className="flex items-center gap-3 shrink-0">
          {children ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {children}
              <CivicResolveLogo subtitle={subtitle} href={logoHref} size="md" />
            </div>
          ) : (
            <CivicResolveLogo subtitle={subtitle} href={logoHref} size="md" />
          )}
        </div>

        {/* Right: Actions, Language Switcher, Theme Toggle & Navigation */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 justify-end">
          {showThemeToggle && <ThemeToggle size="sm" />}
          {showLanguageSwitcher && <LanguageSwitcher />}
          {actions}
        </div>
      </div>
    </header>
  );
}
