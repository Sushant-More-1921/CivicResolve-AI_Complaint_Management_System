"use client";

import React from "react";
import Link from "next/link";
import { BrandHeader } from "@/components/common/brand-header";
import { GlobalHeader } from "@/components/common/global-header";
import { LoginCard } from "@/components/auth/login-card";
import { useLanguage } from "@/context/language-context";
import ROUTES from "@/config/routes";

export default function UnifiedLoginPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col justify-between selection:bg-[#EAF2FF] selection:text-[#0B4EA2] transition-colors">
      {/* Top Portal Navigation Bar */}
      <GlobalHeader
        subtitle={t("signInSubtitle", "Sign in with your mobile number to access CivicResolve.")}
      />

      {/* Main Login Workspace */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          <LoginCard />
        </div>
      </div>

      {/* Institutional Footer */}
      <footer className="w-full bg-white dark:bg-[#0D131F] border-t border-[#E2E8F0] dark:border-[#1E293B] py-4 px-4 text-center text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} {t("brandName")}. {t("directorateSubtitle")}</p>
          <div className="flex items-center gap-4">
            <Link href={ROUTES.COMPLAINTS.TRACK} className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors">
              {t("trackStatus")}
            </Link>
            <Link href={ROUTES.HOME} className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors">
              {t("home", "Home")}
            </Link>
            <span className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors cursor-pointer">
              {t("citizenCharter")}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
