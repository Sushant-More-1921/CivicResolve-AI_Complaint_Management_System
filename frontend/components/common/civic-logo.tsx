"use client";

import React from "react";
import Link from "next/link";
import { Shield } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

export interface CivicResolveLogoProps {
  size?: "sm" | "md" | "lg";
  subtitle?: string | React.ReactNode;
  showSubtitle?: boolean;
  href?: string | null;
  className?: string;
  variant?: "default" | "inverted";
}

/**
 * Official CivicResolve Brand Logo
 * Consistent emblem, proportions, colors, and typography across all pages.
 */
export function CivicResolveLogo({
  size = "md",
  subtitle,
  showSubtitle = true,
  href = "/",
  className,
  variant = "default",
}: CivicResolveLogoProps) {
  const { t } = useLanguage();

  const brandTitle = t("brandName", "CivicResolve");
  const defaultSubtitle = t(
    "brandSubtitle",
    "Citizen Grievance & Municipal Services Portal"
  );
  const activeSubtitle = subtitle ?? defaultSubtitle;

  const sizeClasses = {
    sm: {
      box: "w-8 h-8 rounded-lg",
      icon: "w-4 h-4",
      title: "text-sm sm:text-base",
      subtitle: "text-[10px]",
      gap: "gap-2.5",
    },
    md: {
      box: "w-9 h-9 rounded-lg",
      icon: "w-5 h-5",
      title: "text-base sm:text-lg",
      subtitle: "text-[11px]",
      gap: "gap-3",
    },
    lg: {
      box: "w-14 h-14 rounded-xl",
      icon: "w-8 h-8",
      title: "text-xl sm:text-2xl",
      subtitle: "text-xs sm:text-sm",
      gap: "gap-4",
    },
  }[size];

  const content = (
    <div
      className={cn(
        "inline-flex items-center text-left select-none group",
        sizeClasses.gap,
        className
      )}
    >
      {/* Official CivicResolve Emblem */}
      <div
        className={cn(
          "bg-[#0B4EA2] dark:bg-[#1E40AF] flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-[#083B7A]/20 dark:ring-[#3B82F6]/30 transition-transform group-hover:scale-105",
          sizeClasses.box
        )}
      >
        <Shield className={cn("text-white", sizeClasses.icon)} />
      </div>

      {/* Wordmark and Contextual Subtitle */}
      <div className="flex flex-col min-w-0">
        <span
          className={cn(
            "block font-bold tracking-tight leading-tight",
            sizeClasses.title,
            variant === "inverted"
              ? "text-white"
              : "text-[#0F172A] dark:text-[#F8FAFC]"
          )}
        >
          {brandTitle}
        </span>
        {showSubtitle && activeSubtitle && (
          <span
            className={cn(
              "block font-medium truncate",
              sizeClasses.subtitle,
              variant === "inverted"
                ? "text-slate-300"
                : "text-[#64748B] dark:text-[#94A3B8]"
            )}
          >
            {activeSubtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="inline-flex focus:outline-none focus:ring-2 focus:ring-[#0B4EA2] dark:focus:ring-[#3B82F6] rounded-lg transition-opacity hover:opacity-95"
    >
      {content}
    </Link>
  );
}
