"use client";

import React from "react";
import { AdminLoginCard } from "@/components/auth/admin-login-card";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLanguage } from "@/context/language-context";
import { ShieldCheck, Lock, Building2 } from "lucide-react";
import Link from "next/link";
import ROUTES from "@/config/routes";

export default function AdminLoginPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-[#EAF2FF] selection:text-[#0B4EA2]">
      {/* Top Admin Security Bar */}
      <header className="w-full bg-white border-b border-[#CBD5E1] py-3.5 px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href={ROUTES.HOME} className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-[#083B7A] flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block text-sm sm:text-base font-bold text-[#0F172A] leading-tight">
                {t("brandName")}
              </span>
              <span className="block text-[11px] text-[#64748B]">
                {t("directorateSubtitle")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            <LanguageSwitcher />

            <span className="hidden sm:flex items-center gap-1.5 text-[#0B4EA2] bg-[#F8FAFC] border border-[#CBD5E1] px-3 py-1 rounded-lg text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5" /> {t("officerSecurityConsole")}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-xl bg-[#0B4EA2] flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
                {t("officerPortal")} Login
              </h1>
              <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto">
                Authorized access for Department Admins, Supervisors, and Field Officers.
              </p>
            </div>
          </div>

          <AdminLoginCard />
        </div>
      </div>

      {/* Institutional Security Footer */}
      <footer className="w-full bg-white border-t border-[#CBD5E1] py-4 px-4 text-center text-xs text-[#64748B]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} {t("brandName")}. Authorized Department Personnel Only.</p>
          <div className="flex items-center gap-4">
            <Link href={ROUTES.AUTH.CITIZEN_LOGIN} className="hover:text-[#0B4EA2] font-medium transition-colors">
              Citizen Portal
            </Link>
            <span className="hover:text-[#0B4EA2] transition-colors cursor-pointer">
              IT Support Desk
            </span>
            <span className="hover:text-[#0B4EA2] transition-colors cursor-pointer">
              System Health
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
