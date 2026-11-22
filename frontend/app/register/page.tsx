"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
import { GlobalHeader } from "@/components/common/global-header";
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
          router.push(`${ROUTES.AUTH.LOGIN}?mobile=${cleanMobile}`);
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
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col justify-between selection:bg-[#EAF2FF] selection:text-[#0B4EA2] transition-colors">
      {/* Top Navbar */}
      <GlobalHeader
        subtitle={t("registrationSubtitle")}
        actions={
          <Link
            href={ROUTES.AUTH.LOGIN}
            className="text-xs text-[#0B4EA2] dark:text-[#60A5FA] font-semibold hover:underline"
          >
            {t("alreadyRegisteredLogin")}
          </Link>
        }
      />

      {/* Main Form Workspace */}
      <div className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#0B4EA2] dark:bg-[#1E3A8A] text-white flex items-center justify-center mx-auto shadow-sm ring-4 ring-[#EAF2FF] dark:ring-[#1E293B]">
              <UserCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              Create CivicResolve Account
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
              Register once to lodge civic complaints, track ward resolution progress, and receive official SMS updates.
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-sm p-6 sm:p-8 space-y-5 transition-colors">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border border-[#FECACA] dark:border-[#DC2626]/40 text-[#DC2626] dark:text-[#F87171] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-[#ECFDF3] dark:bg-[#064E3B]/20 border border-[#BBF7D0] dark:border-[#10B981]/40 text-[#15803D] dark:text-[#34D399] text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Full Name (as per ID) <span className="text-[#DC2626] dark:text-[#F87171]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] dark:text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Citizen Name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#EAF2FF] dark:focus:ring-[#3B82F6]/20 transition-all"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Indian Mobile Number <span className="text-[#DC2626] dark:text-[#F87171]">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-xs font-bold text-[#475569] dark:text-[#94A3B8] font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="98765 43210"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
                    className="w-full h-11 pl-12 pr-3 rounded-xl border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs sm:text-sm font-mono font-medium text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#EAF2FF] dark:focus:ring-[#3B82F6]/20 transition-all"
                  />
                </div>
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                  You will receive 6-digit verification codes on this mobile number.
                </span>
              </div>

              {/* Division & Municipality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] block mb-1">
                    Administrative Division
                  </label>
                  <select
                    value={divisionId}
                    onChange={(e) => setDivisionId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  >
                    {INITIAL_DIVISIONS.map((d) => (
                      <option key={d.id} value={d.id} className="dark:bg-[#161F30] dark:text-[#F8FAFC]">
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] block mb-1">
                    Municipal Corporation
                  </label>
                  <select
                    value={authorityId}
                    onChange={(e) => setAuthorityId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  >
                    {INITIAL_AUTHORITIES.map((a) => (
                      <option key={a.id} value={a.id} className="dark:bg-[#161F30] dark:text-[#F8FAFC]">
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ward / Area */}
              <div>
                <label className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] block mb-1">
                  Residential Ward / Area
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#94A3B8] dark:text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. Ward 12, Tarabai Park, Kolhapur North"
                    value={residentialWard}
                    onChange={(e) => setResidentialWard(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-2 pt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#CBD5E1] dark:border-[#2D3748] text-[#0B4EA2] dark:text-[#3B82F6] focus:ring-[#0B4EA2] dark:focus:ring-[#3B82F6]"
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
            <div className="pt-3 border-t border-[#F1F5F9] dark:border-[#1E293B] text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
              Already have an account?{" "}
              <Link href={ROUTES.AUTH.LOGIN} className="font-bold text-[#0B4EA2] dark:text-[#60A5FA] hover:underline">
                Sign In with Mobile OTP
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-[#0D131F] border-t border-[#E2E8F0] dark:border-[#1E293B] py-4 px-4 text-center text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors">
        CivicResolve • Directorate of Municipal & Environmental Services
      </footer>
    </main>
  );
}
