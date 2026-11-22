"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldCheck,
  Edit2,
  Lock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PhoneInput } from "@/components/auth/phone-input";
import { OtpInput } from "@/components/auth/otp-input";
import { ResendTimer } from "@/components/auth/resend-timer";
import { CitizenDetailsForm } from "@/components/auth/citizen-details-form";
import {
  isValidIndianMobile,
  maskMobileNumber,
  formatIndianMobile,
} from "@/lib/validations/auth";
import { sendOtpApi, verifyOtpApi, resendOtpApi } from "@/lib/api/auth";
import { saveSession, getSessionUser, getSessionToken, clearSession } from "@/lib/auth/session";
import { AuthUser } from "@/types/auth";
import { useLanguage } from "@/context/language-context";

type LoginStep = "PHONE_INPUT" | "OTP_INPUT" | "DETAILS_INPUT";

export function LoginCard() {
  const router = useRouter();
  const { t } = useLanguage();

  // Multi-step form state
  const [step, setStep] = useState<LoginStep>("PHONE_INPUT");
  const [mobileNumber, setMobileNumber] = useState<string>("");
  const [otp, setOtp] = useState<string>("");
  const [otpSessionId, setOtpSessionId] = useState<string>("");

  // Verified user session state for onboarding
  const [verifiedUser, setVerifiedUser] = useState<AuthUser | null>(null);
  const [verifiedToken, setVerifiedToken] = useState<string>("");

  // Persistent existing logged-in session state
  const [existingUser, setExistingUser] = useState<AuthUser | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [hasOtpError, setHasOtpError] = useState<boolean>(false);

  // If user is ALREADY logged in on mount, immediately direct to appropriate portal; also read ?mobile= param
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mobileParam = params.get("mobile");
      if (mobileParam) {
        setMobileNumber(mobileParam);
      }
    }

    const token = getSessionToken();
    const user = getSessionUser();
    if (token && user) {
      if (user.role === "SUPER_ADMIN" || user.role === "DEPARTMENT_ADMIN" || user.role === "ADMIN" || user.role === "OFFICER") {
        router.replace("/admin/dashboard");
      } else if (user.role === "CITIZEN") {
        router.replace("/citizen/dashboard");
      }
    }
  }, [router]);

  const getTargetRoute = (userRole?: string) => {
    if (userRole === "SUPER_ADMIN" || userRole === "DEPARTMENT_ADMIN" || userRole === "ADMIN" || userRole === "OFFICER") {
      return "/admin/dashboard";
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get("redirect");
      if (redirectParam && !redirectParam.includes("login") && !redirectParam.startsWith("/admin")) return redirectParam;
    }
    if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "OFFICER") {
      return "/admin/dashboard";
    }
    return "/citizen/dashboard";
  };

  // STEP 1: Handle Send OTP
  const handleSendOtp = async () => {
    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanNumber = mobileNumber.replace(/\D/g, "");
    if (!isValidIndianMobile(cleanNumber)) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendOtpApi(cleanNumber);
      setOtpSessionId(response.otpSessionId || "");
      setSuccessNotice(`One-Time Password dispatched to ${maskMobileNumber(cleanNumber)}`);
      setStep("OTP_INPUT");
      setOtp("");
      setHasOtpError(false);
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : "Failed to transmit OTP. Please try again.";
      setErrorMessage(errText);
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Handle Verify OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const finalOtp = codeToVerify || otp;
    setErrorMessage(null);
    setHasOtpError(false);

    if (finalOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      setHasOtpError(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyOtpApi(mobileNumber, finalOtp, otpSessionId);

      // Persist authenticated credentials
      saveSession(response.token, response.user);

      // If user is brand new or lacks basic profile details, route to DETAILS_INPUT
      if (response.user.role === "CITIZEN" && (response.isNewUser || !response.user.name || response.user.name === "Verified Citizen" || response.user.name === "Citizen")) {
        setVerifiedUser(response.user);
        setVerifiedToken(response.token);
        setStep("DETAILS_INPUT");
        return;
      }

      setSuccessNotice("Authentication successful. Opening your dashboard...");
      const destination = getTargetRoute(response.user.role);
      setTimeout(() => {
        router.push(destination);
      }, 700);
    } catch (err: unknown) {
      const errText =
        err instanceof Error
          ? err.message
          : "Invalid or expired security code. Please try again.";
      setErrorMessage(errText);
      setHasOtpError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    setIsResending(true);
    setErrorMessage(null);
    setHasOtpError(false);
    try {
      const response = await resendOtpApi(mobileNumber);
      setOtpSessionId(response.otpSessionId || "");
      setSuccessNotice("A fresh 6-digit code has been dispatched.");
      setOtp("");
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : "Could not resend OTP. Please wait before retrying.";
      setErrorMessage(errText);
    } finally {
      setIsResending(false);
    }
  };

  // Handle Details Completed Callback
  const handleDetailsSaved = (updatedUser: AuthUser) => {
    setSuccessNotice("Profile saved successfully. Taking you to your dashboard...");
    const destination = getTargetRoute(updatedUser.role);
    setTimeout(() => {
      router.push(destination);
    }, 600);
  };

  // Handle Edit Mobile Number (Return to Step 1)
  const handleEditMobile = () => {
    setStep("PHONE_INPUT");
    setOtp("");
    setErrorMessage(null);
    setSuccessNotice(null);
    setHasOtpError(false);
  };

  const isPhoneValid = isValidIndianMobile(mobileNumber);
  const isOtpValid = otp.length === 6;

  // If user is already logged in, redirect directly to home page without showing intermediate card
  if (existingUser) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-12">
        <div className="w-8 h-8 border-2 border-[#0B4EA2] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Session active. Directing to home page...</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: If user just verified OTP and needs to add Citizen Details
  // =========================================================================
  if (step === "DETAILS_INPUT" && verifiedUser) {
    return (
      <CitizenDetailsForm
        user={verifiedUser}
        token={verifiedToken}
        onCompleted={handleDetailsSaved}
      />
    );
  }

  // =========================================================================
  // VIEW C: Standard Phone & OTP Verification Card
  // =========================================================================
  return (
    <div className="w-full max-w-md mx-auto">
      {/* Container Card */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-sm p-6 sm:p-8 transition-colors">
        {/* Step Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2 uppercase tracking-wider">
            <span>
              {step === "PHONE_INPUT" ? t("authStep1", "Step 1 of 2: Mobile Number") : t("authStep2", "Step 2 of 2: OTP Verification")}
            </span>
            <span className="flex items-center gap-1 text-[#0B4EA2] dark:text-[#60A5FA]">
              <Lock className="w-3.5 h-3.5" /> {t("authSecureAuth", "Secure Authentication")}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            {step === "PHONE_INPUT" ? t("authSignInTitle", "Sign In") : t("authVerifyMobileTitle", "Verify Your Mobile")}
          </h2>

          <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
            {step === "PHONE_INPUT"
              ? t("authUnifiedLoginPrompt", "Enter your 10-digit mobile number to access your CivicResolve account.")
              : t("authOtpSentPrompt", "We have dispatched a 6-digit one-time PIN to your mobile device.")}
          </p>
        </div>

        {/* Global Feedback Messages */}
        {errorMessage && (
          <div className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Alert variant="danger" title="Authentication Error">
              {errorMessage}
            </Alert>
          </div>
        )}

        {successNotice && !errorMessage && (
          <div className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Alert variant="success" title="Success">
              {successNotice}
            </Alert>
          </div>
        )}

        {/* STEP 1: PHONE NUMBER INPUT */}
        {step === "PHONE_INPUT" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isPhoneValid && !isLoading) handleSendOtp();
            }}
            className="space-y-5"
          >
            <PhoneInput
              value={mobileNumber}
              onChange={(val) => {
                setMobileNumber(val);
                if (errorMessage) setErrorMessage(null);
              }}
              error={null}
              disabled={isLoading}
              onEnterPress={handleSendOtp}
              autoFocus
            />
            {/* Submit Action */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-semibold py-3"
              isLoading={isLoading}
              disabled={!isPhoneValid || isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {t("authSendOtpBtn", "Send OTP")}
            </Button>
          </form>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === "OTP_INPUT" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isOtpValid && !isLoading) handleVerifyOtp();
            }}
            className="space-y-5"
          >
            {/* Target Mobile Banner with Edit Action */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
              <div className="text-left">
                <span className="block text-xs text-[#64748B] dark:text-[#94A3B8]">{t("authOtpSentTo", "Verification code sent to")}</span>
                <span className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] tracking-wide">
                  +91 {formatIndianMobile(mobileNumber)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleEditMobile}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B4EA2] dark:text-[#60A5FA] hover:text-[#083B7A] dark:hover:text-[#93C5FD] hover:underline p-1.5 rounded transition-colors"
                aria-label="Edit mobile number"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{t("authChangeBtn", "Change")}</span>
              </button>
            </div>

            {/* 6-Digit OTP Box Grid */}
            <div className="text-left space-y-1.5">
              <label className="block text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {t("authEnterOtpLabel", "Enter 6-Digit OTP")} <span className="text-[#DC2626] dark:text-[#F87171]">*</span>
              </label>

              <OtpInput
                length={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (errorMessage) setErrorMessage(null);
                  if (hasOtpError) setHasOtpError(false);
                }}
                onComplete={(completedOtp) => {
                  handleVerifyOtp(completedOtp);
                }}
                disabled={isLoading}
                hasError={hasOtpError}
                autoFocus
              />
            </div>

            {/* Countdown / Resend OTP Action */}
            <ResendTimer
              initialSeconds={45}
              onResend={handleResendOtp}
              isResending={isResending}
              disabled={isLoading}
            />


            {/* Verify Action Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full text-base font-semibold py-3"
              isLoading={isLoading}
              disabled={!isOtpValid || isLoading}
              rightIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              {t("authVerifyOtpBtn", "Verify OTP & Proceed")}
            </Button>
          </form>
        )}

        {/* Institutional Trust Footnote */}
        <div className="mt-6 pt-5 border-t border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <ShieldCheck className="w-4 h-4 text-[#16A34A] dark:text-[#34D399]" />
          <span>{t("authEncryptedFootnote", "Official Municipal Grievance Portal • End-to-End Encrypted")}</span>
        </div>
      </div>
    </div>
  );
}
