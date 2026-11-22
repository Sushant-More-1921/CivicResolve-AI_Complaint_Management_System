"use client";

import React from "react";
import { Shield } from "lucide-react";
import { useLanguage } from "@/context/language-context";

interface BrandHeaderProps {
  subtitle?: string;
  badge?: string;
}

/**
 * Standardized CivicResolve Auth Header & Institutional Emblem
 */
export function BrandHeader({ subtitle, badge }: BrandHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center text-center space-y-3">
      {/* Official CivicResolve Emblem (Large) */}
      <div className="w-14 h-14 rounded-2xl bg-[#0B4EA2] dark:bg-[#1E3A8A] flex items-center justify-center text-white shadow-sm ring-4 ring-[#EAF2FF] dark:ring-[#1E293B]">
        <Shield className="w-8 h-8 text-white" />
      </div>

      <div>
        {badge && (
          <span className="inline-block text-[11px] font-semibold text-[#0B4EA2] dark:text-[#60A5FA] bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 border border-[#BFDBFE]/50 dark:border-[#1E40AF]/40 px-2.5 py-0.5 rounded-full mb-1">
            {badge}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
          {t("brandName", "CivicResolve")}
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-sm mx-auto leading-relaxed">
          {subtitle ||
            t(
              "signInSubtitle",
              "Sign in with your mobile number to lodge civic complaints and track resolution progress."
            )}
        </p>
      </div>
    </div>
  );
}
