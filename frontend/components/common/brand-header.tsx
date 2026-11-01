"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export function BrandHeader() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center text-center space-y-3">
      {/* Institutional Emblem Badge */}
      <div className="w-14 h-14 rounded-xl bg-[#0B4EA2] flex items-center justify-center text-white shadow-xs">
        <ShieldCheck className="w-8 h-8 text-white" />
      </div>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
          {t("brandName")}
        </h1>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
          {t("signInSubtitle", "Sign in with your mobile number to lodge civic complaints and track resolution progress.")}
        </p>
      </div>
    </div>
  );
}
