"use client";

import React from "react";
import { BrandHeader } from "@/components/common/brand-header";
import { LoginCard } from "@/components/auth/login-card";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLanguage } from "@/context/language-context";
import { Shield } from "lucide-react";
import Link from "next/link";
import ROUTES from "@/config/routes";

export default function CitizenLoginPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-[#EAF2FF] selection:text-[#0B4EA2]">
      {/* Top Portal Navigation Bar */}
      <header className="w-full bg-white border-b border-[#E2E8F0] py-3.5 px-4 sm:px-8 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href={ROUTES.HOME} className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#0B4EA2] flex items-center justify-center text-white shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block text-sm sm:text-base font-bold text-[#0F172A] leading-tight">
                {t("brandName")}
              </span>
              <span className="block text-[11px] text-[#64748B]">
                {t("citizenServicesSubtitle")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <LanguageSwitcher />

            <Link
              href={ROUTES.AUTH.ADMIN_LOGIN}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B4EA2] hover:text-[#083B7A] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#CBD5E1] px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>{t("officerPortal")}</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Workspace */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          <BrandHeader />
          <LoginCard />
        </div>
      </div>

      {/* Institutional Footer */}
      <footer className="w-full bg-white border-t border-[#E2E8F0] py-4 px-4 text-center text-xs text-[#64748B]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} {t("brandName")}. {t("directorateSubtitle")}</p>
          <div className="flex items-center gap-4">
            <Link href={ROUTES.AUTH.ADMIN_LOGIN} className="hover:text-[#0B4EA2] transition-colors">
              {t("officerLogin")}
            </Link>
            <Link href={ROUTES.COMPLAINTS.TRACK} className="hover:text-[#0B4EA2] transition-colors">
              {t("trackStatus")}
            </Link>
            <span className="hover:text-[#0B4EA2] transition-colors cursor-pointer">
              {t("citizenCharter")}
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
