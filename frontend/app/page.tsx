"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Search,
  FilePlus,
  ClipboardList,
  ArrowRight,
  Building2,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLanguage } from "@/context/language-context";
import { getSessionUser, clearSession } from "@/lib/auth/session";
import { AuthUser } from "@/types/auth";
import ROUTES from "@/config/routes";

export default function HomePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [trackingInput, setTrackingInput] = useState("");
  const [deletedNotice, setDeletedNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("deleted") === "true") {
        setDeletedNotice(true);
        window.history.replaceState({}, document.title, "/");
        setTimeout(() => setDeletedNotice(false), 6000);
      }
    }

    const timer = setTimeout(() => {
      const user = getSessionUser();
      if (user) {
        setCurrentUser(user);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingInput.trim()) {
      router.push(`${ROUTES.COMPLAINTS.TRACK}?id=${encodeURIComponent(trackingInput.trim())}`);
    } else {
      router.push(ROUTES.COMPLAINTS.TRACK);
    }
  };

  const categories = [
    {
      name: t("catSolidWaste"),
      desc: t("catSolidWasteDesc"),
      sla: t("catSolidWasteSla"),
    },
    {
      name: t("catWater"),
      desc: t("catWaterDesc"),
      sla: t("catWaterSla"),
    },
    {
      name: t("catRoads"),
      desc: t("catRoadsDesc"),
      sla: t("catRoadsSla"),
    },
    {
      name: t("catSewage"),
      desc: t("catSewageDesc"),
      sla: t("catSewageSla"),
    },
    {
      name: t("catStreetlights"),
      desc: t("catStreetlightsDesc"),
      sla: t("catStreetlightsSla"),
    },
    {
      name: t("catHazardous"),
      desc: t("catHazardousDesc"),
      sla: t("catHazardousSla"),
    },
  ];

  const processSteps = [
    {
      step: 1,
      title: t("step1Title"),
      desc: t("step1Desc"),
    },
    {
      step: 2,
      title: t("step2Title"),
      desc: t("step2Desc"),
    },
    {
      step: 3,
      title: t("step3Title"),
      desc: t("step3Desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between text-[#0F172A] selection:bg-[#E2E8F0]">
      {/* ==================== 1. OFFICIAL CIVIC HEADER ==================== */}
      <header className="w-full bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href={ROUTES.HOME} className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#0B4EA2] flex items-center justify-center text-white shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block text-base sm:text-lg font-bold text-[#0F172A] leading-tight">
                {t("brandName")}
              </span>
              <span className="block text-[11px] text-[#64748B]">
                {t("brandSubtitle")}
              </span>
            </div>
          </Link>

          {/* User, Officer Navigation & Language Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
            {/* Header Language Switcher */}
            <LanguageSwitcher />

            {currentUser ? (
              <>
                <Link href={ROUTES.CITIZEN.DASHBOARD}>
                  <Button variant="outline" size="sm" className="text-xs" leftIcon={<User className="w-3.5 h-3.5" />}>
                    {t("myComplaints")}
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearSession();
                    setCurrentUser(null);
                    router.push(ROUTES.HOME);
                  }}
                  className="text-xs text-[#64748B]"
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                >
                  {t("logout")}
                </Button>
              </>
            ) : (
              <Link href={ROUTES.AUTH.CITIZEN_LOGIN}>
                <Button variant="ghost" size="sm" className="text-xs font-semibold">
                  {t("citizenLogin")}
                </Button>
              </Link>
            )}

            <Link href={ROUTES.ADMIN.DASHBOARD}>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-[#CBD5E1] text-[#334155]"
                leftIcon={<Building2 className="w-3.5 h-3.5 text-[#0B4EA2]" />}
              >
                {t("officerPortal")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {deletedNotice && (
        <div className="w-full bg-emerald-50 border-b border-emerald-200 py-3 px-4 text-center text-xs font-semibold text-emerald-800 animate-in fade-in duration-300">
          ✅ Your citizen account and personal records have been permanently deleted from the municipal database.
        </div>
      )}

      {/* ==================== 2. HERO & 3 PRIMARY ACTIONS ==================== */}
      <main className="flex-1">
        <section className="bg-white border-b border-[#E2E8F0] py-10 sm:py-14">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              {t("heroTitle")}
            </h1>
            <p className="text-sm sm:text-base text-[#475569] max-w-2xl mx-auto leading-relaxed">
              {t("heroSubtitle")}
            </p>
          </div>

          {/* 3 Core Citizen Actions Grid */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Action 1: Register a Complaint */}
              <div className="bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0] flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] text-[#0B4EA2] flex items-center justify-center">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    {t("action1Title")}
                  </h2>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {t("action1Desc")}
                  </p>
                </div>
                <div className="pt-5">
                  <Link
                    href={
                      currentUser
                        ? ROUTES.CITIZEN.NEW_COMPLAINT
                        : `${ROUTES.AUTH.CITIZEN_LOGIN}?redirect=/citizen/complaints/new`
                    }
                    className="block"
                  >
                    <Button variant="primary" size="md" className="w-full text-xs font-bold" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      {t("action1Btn")}
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Action 2: Track Complaint Status */}
              <div className="bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0] flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] text-[#0B4EA2] flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    {t("action2Title")}
                  </h2>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {t("action2Desc")}
                  </p>
                </div>
                <form onSubmit={handleTrackSubmit} className="pt-4 space-y-2">
                  <input
                    type="text"
                    placeholder={t("action2Placeholder")}
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0B4EA2]"
                  />
                  <Button type="submit" variant="outline" size="md" className="w-full text-xs font-semibold border-[#CBD5E1]">
                    {t("action2Btn")}
                  </Button>
                </form>
              </div>

              {/* Action 3: My Complaints */}
              <div className="bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0] flex flex-col justify-between hover:border-[#CBD5E1] transition-colors">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] text-[#0B4EA2] flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A]">
                    {t("action3Title")}
                  </h2>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {t("action3Desc")}
                  </p>
                </div>
                <div className="pt-5">
                  <Link
                    href={
                      currentUser
                        ? ROUTES.CITIZEN.DASHBOARD
                        : `${ROUTES.AUTH.CITIZEN_LOGIN}?redirect=/citizen/dashboard`
                    }
                    className="block"
                  >
                    <Button variant="outline" size="md" className="w-full text-xs font-semibold border-[#CBD5E1]">
                      {t("action3Btn")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 3. REPORTABLE CATEGORIES ==================== */}
        <section className="py-12 bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8 space-y-1">
              <h2 className="text-xl font-bold text-[#0F172A]">
                {t("categoriesTitle")}
              </h2>
              <p className="text-xs text-[#64748B]">
                {t("categoriesSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-xl border border-[#E2E8F0] flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-[#0F172A]">{cat.name}</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                        {cat.sla}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#F1F5F9]">
                    <Link
                      href={
                        currentUser
                          ? ROUTES.CITIZEN.NEW_COMPLAINT
                          : `${ROUTES.AUTH.CITIZEN_LOGIN}?redirect=/citizen/complaints/new`
                      }
                      className="text-xs font-semibold text-[#0B4EA2] hover:underline flex items-center gap-1"
                    >
                      <span>{t("catActionLink")}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 4. HOW IT WORKS (CLEAN & SIMPLE) ==================== */}
        <section className="py-12 bg-white border-t border-b border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8 space-y-1">
              <h2 className="text-xl font-bold text-[#0F172A]">
                {t("processTitle")}
              </h2>
              <p className="text-xs text-[#64748B]">
                {t("processSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {processSteps.map((item) => (
                <div key={item.step} className="p-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-2">
                  <div className="w-7 h-7 rounded-full bg-[#0B4EA2] text-white flex items-center justify-center font-bold text-xs">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-sm text-[#0F172A]">{item.title}</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ==================== 5. INSTITUTIONAL FOOTER ==================== */}
      <footer className="bg-white border-t border-[#E2E8F0] py-8 px-4 sm:px-6 text-xs text-[#64748B]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <span className="font-bold text-[#0F172A] block">
              {t("brandName")}
            </span>
            <p className="text-[11px]">
              {t("helplineText")}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-[#475569]">
            <Link href={ROUTES.COMPLAINTS.TRACK} className="hover:text-[#0B4EA2]">
              {t("trackStatus")}
            </Link>
            <Link href={ROUTES.CITIZEN.NEW_COMPLAINT} className="hover:text-[#0B4EA2]">
              {t("registerComplaint")}
            </Link>
            <Link href={ROUTES.CITIZEN.DASHBOARD} className="hover:text-[#0B4EA2]">
              {t("myComplaints")}
            </Link>
            <Link href={ROUTES.AUTH.ADMIN_LOGIN} className="hover:text-[#0B4EA2]">
              {t("officerLogin")}
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto pt-6 mt-6 border-t border-[#E2E8F0] text-center text-[11px] text-[#94A3B8]">
          © {new Date().getFullYear()} {t("allRightsReserved")}
        </div>
      </footer>
    </div>
  );
}
