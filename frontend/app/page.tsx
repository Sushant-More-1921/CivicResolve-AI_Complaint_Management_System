"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  FilePlus,
  ClipboardList,
  ArrowRight,
  Building2,
  User,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalHeader } from "@/components/common/global-header";
import { useLanguage } from "@/context/language-context";
import { getSessionUser, getSessionToken, clearSession, saveSession } from "@/lib/auth/session";
import { getUserProfileApi } from "@/lib/api/auth";
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
      const token = getSessionToken();
      if (user) {
        setCurrentUser(user);
        if (token) {
          getUserProfileApi(token).then((fresh) => {
            if (fresh && fresh.name && fresh.name.trim()) {
              setCurrentUser(fresh);
              saveSession(token, fresh);
            }
          }).catch(() => {});
        }
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

  const isStaff =
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "DEPARTMENT_ADMIN" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.role === "OFFICER";

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col justify-between text-[#0F172A] dark:text-[#F8FAFC] selection:bg-[#E2E8F0] dark:selection:bg-[#1E293B] transition-colors">
      {/* 1. CIVIC HEADER */}
      <GlobalHeader
        subtitle={t("brandSubtitle")}
        actions={
          <>
            {currentUser ? (
              <>
                <Link href={isStaff ? ROUTES.ADMIN.DASHBOARD : ROUTES.CITIZEN.DASHBOARD}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    leftIcon={<User className="w-3.5 h-3.5 text-[#0B4EA2] dark:text-[#60A5FA]" />}
                  >
                    {currentUser.name && currentUser.name.trim() !== "" && currentUser.name !== "Citizen" ? currentUser.name : t("myComplaints")}
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
                  className="text-xs text-[#64748B] dark:text-[#94A3B8]"
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                >
                  {t("logout")}
                </Button>
              </>
            ) : (
              <Link href={ROUTES.AUTH.LOGIN}>
                <Button variant="primary" size="sm" className="text-xs font-semibold">
                  {t("signInBtn", "Sign In")}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {deletedNotice && (
        <div className="w-full bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 py-3 px-4 text-center text-xs font-semibold text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-300 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Your citizen account and personal records have been removed from the database.</span>
        </div>
      )}

      {/* 2. HERO & PRIMARY ACTIONS */}
      <main className="flex-1">
        <section className="bg-white dark:bg-[#0D131F] border-b border-[#E2E8F0] dark:border-[#1E293B] py-10 sm:py-14 transition-colors">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-3">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              {t("heroTitle")}
            </h1>
            <p className="text-sm sm:text-base text-[#475569] dark:text-[#94A3B8] max-w-2xl mx-auto leading-relaxed">
              {t("heroSubtitle")}
            </p>
          </div>

          {/* 3 Core Citizen Actions Grid */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Action 1: Register a Complaint */}
              <div className="bg-[#F8FAFC] dark:bg-[#111827] p-6 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] flex flex-col justify-between hover:border-[#CBD5E1] dark:hover:border-[#334155] transition-colors shadow-2xs">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] flex items-center justify-center">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {t("action1Title")}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {t("action1Desc")}
                  </p>
                </div>
                <div className="pt-5">
                  <Link
                    href={
                      currentUser
                        ? isStaff
                          ? ROUTES.ADMIN.DASHBOARD
                          : ROUTES.CITIZEN.NEW_COMPLAINT
                        : `${ROUTES.AUTH.LOGIN}?redirect=/citizen/complaints/new`
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
              <div className="bg-[#F8FAFC] dark:bg-[#111827] p-6 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] flex flex-col justify-between hover:border-[#CBD5E1] dark:hover:border-[#334155] transition-colors shadow-2xs">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] flex items-center justify-center">
                    <Search className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {t("action2Title")}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {t("action2Desc")}
                  </p>
                </div>
                <form onSubmit={handleTrackSubmit} className="pt-4 space-y-2">
                  <input
                    type="text"
                    placeholder={t("action2Placeholder")}
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  />
                  <Button type="submit" variant="outline" size="md" className="w-full text-xs font-semibold border-[#CBD5E1] dark:border-[#2D3748]">
                    {t("action2Btn")}
                  </Button>
                </form>
              </div>

              {/* Action 3: My Complaints */}
              <div className="bg-[#F8FAFC] dark:bg-[#111827] p-6 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] flex flex-col justify-between hover:border-[#CBD5E1] dark:hover:border-[#334155] transition-colors shadow-2xs">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    {t("action3Title")}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {t("action3Desc")}
                  </p>
                </div>
                <div className="pt-5">
                  <Link
                    href={
                      currentUser
                        ? isStaff
                          ? ROUTES.ADMIN.DASHBOARD
                          : ROUTES.CITIZEN.DASHBOARD
                        : `${ROUTES.AUTH.LOGIN}?redirect=/citizen/dashboard`
                    }
                    className="block"
                  >
                    <Button variant="outline" size="md" className="w-full text-xs font-semibold border-[#CBD5E1] dark:border-[#2D3748]">
                      {t("action3Btn")}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. CIVIC CATEGORIES */}
        <section className="py-12 bg-[#F8FAFC] dark:bg-[#0B0F17] transition-colors">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8 space-y-1">
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t("categoriesTitle")}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {t("categoriesSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] flex flex-col justify-between shadow-2xs hover:border-[#CBD5E1] dark:hover:border-[#334155] transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">{cat.name}</h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#2D3748]">
                        {cat.sla}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-[#F1F5F9] dark:border-[#1E293B]">
                    <Link
                      href={
                        currentUser
                          ? isStaff
                            ? ROUTES.ADMIN.DASHBOARD
                            : ROUTES.CITIZEN.NEW_COMPLAINT
                          : `${ROUTES.AUTH.LOGIN}?redirect=/citizen/complaints/new`
                      }
                      className="text-xs font-semibold text-[#0B4EA2] dark:text-[#60A5FA] hover:underline flex items-center gap-1"
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

        {/* 4. REDRESSAL PROCESS */}
        <section className="py-12 bg-white dark:bg-[#0D131F] border-t border-b border-[#E2E8F0] dark:border-[#1E293B] transition-colors">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8 space-y-1">
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {t("processTitle")}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {t("processSubtitle")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {processSteps.map((item) => (
                <div key={item.step} className="p-5 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#111827] space-y-2 shadow-2xs">
                  <div className="w-7 h-7 rounded-full bg-[#0B4EA2] dark:bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">{item.title}</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer className="bg-white dark:bg-[#0D131F] border-t border-[#E2E8F0] dark:border-[#1E293B] py-8 px-4 sm:px-6 text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block">
              {t("brandName")}
            </span>
            <p className="text-[11px]">
              {t("helplineText")}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
            <Link href={ROUTES.COMPLAINTS.TRACK} className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors">
              {t("trackStatus")}
            </Link>
            <Link href={ROUTES.CITIZEN.NEW_COMPLAINT} className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors">
              {t("registerComplaint")}
            </Link>
            <Link href={ROUTES.CITIZEN.DASHBOARD} className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors">
              {t("myComplaints")}
            </Link>
            <Link href={ROUTES.AUTH.LOGIN} className="hover:text-[#0B4EA2] dark:hover:text-[#60A5FA] transition-colors">
              {t("signInBtn", "Sign In")}
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto pt-6 mt-6 border-t border-[#E2E8F0] dark:border-[#1E293B] text-center text-[11px] text-[#94A3B8] dark:text-[#64748B]">
          © {new Date().getFullYear()} {t("allRightsReserved")}
        </div>
      </footer>
    </div>
  );
}
