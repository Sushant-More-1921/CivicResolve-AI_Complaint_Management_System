"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  User,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerCitizenApi } from "@/lib/api/auth";
import { isValidIndianMobile } from "@/lib/validations/auth";
import { INITIAL_DIVISIONS, INITIAL_AUTHORITIES } from "@/lib/api/hierarchy";
import ROUTES from "@/config/routes";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLanguage } from "@/context/language-context";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [divisionId, setDivisionId] = useState("div-kolhapur");
  const [authorityId, setAuthorityId] = useState("auth-kmc");
  const [residentialWard, setResidentialWard] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanMobile = mobileNumber.replace(/\D/g, "");
    if (!isValidIndianMobile(cleanMobile)) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number starting with 6-9.");
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMessage("Please enter your full official name (minimum 3 characters).");
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerCitizenApi({
        phoneNumber: cleanMobile,
        name: fullName.trim(),
      });

      if (response.success) {
        setSuccessMessage("Citizen profile registered successfully! Redirecting to OTP verification...");
        setTimeout(() => {
          router.push(`${ROUTES.AUTH.CITIZEN_LOGIN}?mobile=${cleanMobile}`);
        }, 1200);
      } else {
        setErrorMessage(response.message || "Registration failed. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please check your connection.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between selection:bg-[#EAF2FF] selection:text-[#0B4EA2]">
      {/* Top Navbar */}
      <header className="w-full bg-white border-b border-[#E2E8F0] py-3.5 px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link href={ROUTES.HOME} className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#0B4EA2] flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block text-sm sm:text-base font-bold text-[#0F172A] leading-tight">
                {t("brandName")}
              </span>
              <span className="block text-[11px] font-medium text-[#64748B]">
                {t("registrationSubtitle")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end text-xs">
            <LanguageSwitcher />

            <Link
              href={ROUTES.AUTH.CITIZEN_LOGIN}
              className="text-[#0B4EA2] font-semibold hover:underline"
            >
              {t("alreadyRegisteredLogin")}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Form Workspace */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0B4EA2] text-white flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#EAF2FF]">
              <UserCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              Create CivicResolve Account
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-sm mx-auto">
              Register once to lodge civic complaints, track ward resolution progress, and receive official SMS updates.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-[#ECFDF3] border border-[#BBF7D0] text-[#15803D] text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                  Full Name (as per ID) <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Citizen Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#EAF2FF]"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                  Indian Mobile Number <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-[#475569] font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="98765 43210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                    className="w-full h-11 pl-12 pr-3 rounded-xl border border-[#CBD5E1] text-xs sm:text-sm font-mono font-medium text-[#0F172A] focus:outline-none focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#EAF2FF]"
                  />
                </div>
                <span className="text-[11px] text-[#64748B] mt-1 block">
                  You will receive 6-digit verification codes on this mobile number.
                </span>
              </div>

              {/* Division & Municipality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                    Administrative Division
                  </label>
                  <select
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A]"
                  >
                    {INITIAL_DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                    Municipal Corporation
                  </label>
                  <select
                    value={authorityId}
                    onChange={(e) => setAuthorityId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A]"
                  >
                    {INITIAL_AUTHORITIES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ward / Area */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] block mb-1">
                  Residential Ward / Area (Optional)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Ward 12, Tarabai Park, Kolhapur North"
                    value={residentialWard}
                    onChange={(e) => setResidentialWard(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A]"
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-2 pt-1 text-xs text-[#64748B]">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#CBD5E1] text-[#0B4EA2] focus:ring-[#0B4EA2]"
                />
                <label htmlFor="agree">
                  I agree to receive official grievance status SMS notifications under the Maharashtra Public Services Act.
                </label>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                disabled={!agreedToTerms}
                className="w-full h-11 text-xs font-bold shadow-xs mt-2"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Register & Verify Mobile Number
              </Button>
            </form>

            {/* Quick Links */}
            <div className="pt-3 border-t border-[#F1F5F9] text-center text-xs text-[#64748B]">
              Already have an account?{" "}
              <Link href={ROUTES.AUTH.CITIZEN_LOGIN} className="font-bold text-[#0B4EA2] hover:underline">
                Citizen Mobile Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-white border-t border-[#E2E8F0] py-4 px-4 text-center text-xs text-[#64748B]">
        CivicResolve • Directorate of Municipal & Environmental Services
      </footer>
    </main>
  );
}