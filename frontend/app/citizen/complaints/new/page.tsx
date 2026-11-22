"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Shield,
  UserCheck,
  MapPin,
  Camera,
  Mic,
  Send,
  ArrowLeft,
  LogOut,
  Edit3,
  Check,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalHeader } from "@/components/common/global-header";
import { useLanguage } from "@/context/language-context";
import { getSessionUser, getSessionToken, clearSession, saveSession } from "@/lib/auth/session";
import { getUserProfileApi } from "@/lib/api/auth";
import { AuthUser } from "@/types/auth";
import {
  submitComplaintApi,
  transcribeComplaintAudioApi,
  validateComplaintImageApi,
  ValidateComplaintImageResponse,
  verifyComplaintDescriptionApi,
  VerifyComplaintDescriptionResponse,
} from "@/lib/api/complaint-client";
import { WhisperVoiceTextarea } from "@/components/voice/whisper-voice-textarea";
import { emitRealTimeEvent } from "@/lib/realtime/events";
import dynamic from "next/dynamic";
import Link from "next/link";

const LocationPickerMap = dynamic(
  () => import("@/components/map/location-picker-map").then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] sm:h-[380px] bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] flex flex-col items-center justify-center gap-2 text-[#64748B] text-xs font-semibold animate-pulse">
        <div className="w-6 h-6 border-2 border-[#0B4EA2] border-t-transparent rounded-full animate-spin" />
        <span>Loading map...</span>
      </div>
    ),
  }
);

type ComplaintImageType = "image/jpeg" | "image/png" | "image/webp";

function isComplaintImageType(type: string): type is ComplaintImageType {
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

export default function NewComplaintPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTrackingNumber, setSubmittedTrackingNumber] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string>("");
  const [showMap, setShowMap] = useState(false);
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<"en" | "hi" | "mr" | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioName, setAudioName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setImagePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyComplaintDescriptionResponse | null>(null);
  const [isValidatingImage, setIsValidatingImage] = useState(false);
  const [imageValidationResult, setImageValidationResult] = useState<ValidateComplaintImageResponse | null>(null);
  const imageValidationSeqRef = useRef(0);

  const handleVerifyDescription = async () => {
    const trimmed = description.trim();
    if (trimmed.length < 5) return;
    setIsVerifying(true);
    try {
      const result = await verifyComplaintDescriptionApi({
        description: trimmed,
        selected_category: selectedCategory || null,
        language: language || "auto",
      });
      setVerificationResult(result);
    } catch (err) {
      console.warn("AI description verification skipped:", err);
    } finally {
      setIsVerifying(false);
    }
  };
  const audioInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  const readImageAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Could not read the selected image."));
          return;
        }
        const img = new Image();
        img.onload = () => {
          try {
            const maxDimension = 1200;
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve((reader.result as string).split(",", 2)[1]);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.82);
            resolve(compressed.split(",", 2)[1]);
          } catch {
            resolve((reader.result as string).split(",", 2)[1]);
          }
        };
        img.onerror = () => {
          resolve((reader.result as string).split(",", 2)[1]);
        };
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Could not read the selected image."));
      reader.readAsDataURL(file);
    });

  const readValidationImagePayload = (
    file: File
  ): Promise<{ imageBase64: string; contentType: ComplaintImageType }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Could not read the selected image."));
          return;
        }
        const rawB64 = reader.result.split(",", 2)[1];
        const origType = (isComplaintImageType(file.type) ? file.type : "image/jpeg") as ComplaintImageType;
        const img = new Image();
        img.onload = () => {
          try {
            const maxDimension = 1024;
            let { width, height } = img;
            if (width <= maxDimension && height <= maxDimension && file.size <= 2 * 1024 * 1024) {
              resolve({ imageBase64: rawB64, contentType: origType });
              return;
            }
            if (width > height) {
              height = Math.max(1, Math.round((height * maxDimension) / width));
              width = maxDimension;
            } else {
              width = Math.max(1, Math.round((width * maxDimension) / height));
              height = maxDimension;
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve({ imageBase64: rawB64, contentType: origType });
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL("image/jpeg", 0.84);
            resolve({ imageBase64: compressed.split(",", 2)[1], contentType: "image/jpeg" });
          } catch {
            resolve({ imageBase64: rawB64, contentType: origType });
          }
        };
        img.onerror = () => {
          resolve({ imageBase64: rawB64, contentType: origType });
        };
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Could not read the selected image."));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    const sessionToken = getSessionToken();
    const sessionUser = getSessionUser();
    const timer = window.setTimeout(() => {
      if (sessionToken && sessionUser) {
        const normalizedRole = sessionUser.role === "ADMIN" ? "DEPARTMENT_ADMIN" : sessionUser.role;
        if (normalizedRole !== "CITIZEN") {
          router.replace("/admin/dashboard");
          return;
        }
        setUser(sessionUser);
        // Refresh with latest profile name from database
        getUserProfileApi(sessionToken).then((fresh) => {
          if (fresh && fresh.name && fresh.name.trim()) {
            setUser(fresh);
            saveSession(sessionToken, fresh);
          }
        }).catch(() => {});
      } else {
        setUser(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push("/");
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setSubmissionError("Location services are not available in this browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setIsLocating(false);
        setSubmissionError(null);
      },
      () => {
        setIsLocating(false);
        setSubmissionError("Location could not be detected. You can still submit the complaint.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    setSubmittedTrackingNumber(null);
    const token = getSessionToken();
    if (!user || !token) {
      clearSession();
      setUser(null);
      setSubmissionError("Your session has expired or you are not signed in. Please sign in to submit your grievance.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const category = selectedCategory || String(form.get("category") || "");

    if (!category) {
      setSubmissionError("Please select a grievance category.");
      return;
    }

    if (!description.trim()) {
      setSubmissionError("Please enter a complaint description.");
      return;
    }

    // Ensure AI verification has run before permitting submission
    let activeVerification = verificationResult;
    if (!activeVerification && description.trim()) {
      setIsVerifying(true);
      try {
        activeVerification = await verifyComplaintDescriptionApi({
          description: description.trim(),
          selected_category: category,
          language: language || "auto",
        });
        setVerificationResult(activeVerification);
      } catch (err) {
        console.warn("AI verification check skipped due to network/service:", err);
      } finally {
        setIsVerifying(false);
      }
    }

    // STRICT GUARD 1: Block non-civic, test, personal introduction, or invalid descriptions
    if (activeVerification && (!activeVerification.is_relevant || activeVerification.status === "invalid")) {
      setSubmissionError(
        `Submission Blocked: ${activeVerification.message}`
      );
      return;
    }

    // STRICT GUARD 2: Block confirmed category mismatch (keep category change solution as it is)
    if (activeVerification && activeVerification.status === "mismatch") {
      setSubmissionError(
        `Category Mismatch: Your description appears to be about "${activeVerification.predicted_category}". Please switch the category or clarify your description before submitting.`
      );
      return;
    }

    // STRICT GUARD 3: Block photos flagged as INVALID by real-time AI evidence validator
    if (image && imageValidationResult?.status === "INVALID") {
      setSubmissionError(
        t(
          "photoInvalidMsg",
          "This image does not appear to show the reported civic issue. Please upload a clear photo of the problem."
        )
      );
      return;
    }

    if (!resolvedAddress?.trim() && !location) {
      setSubmissionError("Please provide an incident location (enter address or pin on map).");
      return;
    }
    setIsSubmitting(true);
    try {
      let imageFields: {
        imageBase64?: string;
        imageContentType?: ComplaintImageType;
      } = {};
      if (image) {
        if (!isComplaintImageType(image.type)) {
          throw new Error("Choose a JPEG, PNG, or WebP photo.");
        }
        const imgPayload = await readValidationImagePayload(image);
        imageFields = {
          imageBase64: imgPayload.imageBase64,
          imageContentType: imgPayload.contentType,
        };
      }
      const complaint = await submitComplaintApi({
        description,
        category,
        ...(language ? { language } : {}),
        ...imageFields,
        ...(location || {}),
        ...(resolvedAddress ? { location: resolvedAddress } : {}),
      });
      setSubmittedTrackingNumber(complaint.trackingNumber);
      emitRealTimeEvent("NEW_INCIDENT_CREATED", {
        trackingNumber: complaint.trackingNumber,
        complaintId: complaint.id,
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Complaint submission failed. Please try again.";
      if (
        errMsg.toLowerCase().includes("session") ||
        errMsg.toLowerCase().includes("token") ||
        errMsg.toLowerCase().includes("unauthorized")
      ) {
        clearSession();
        setUser(null);
        setSubmissionError("Your session has expired. Please sign in again with your mobile number to submit the grievance.");
      } else {
        setSubmissionError(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAudioSelection = async (file?: File) => {
    if (!file) return;
    setSubmissionError(null);
    setIsTranscribing(true);
    setAudioName(file.name);
    try {
      const result = await transcribeComplaintAudioApi(file);
      setDescription((current) =>
        current.trim() ? `${current.trim()}\n${result.text}` : result.text
      );
      setLanguage(result.language);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Audio transcription failed."
      );
      setAudioName("");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleImageSelection = (file?: File) => {
    setSubmissionError(null);
    setImageValidationResult(null);
    if (!file) {
      setImage(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImage(null);
      setSubmissionError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImage(null);
      setSubmissionError("Photo must be smaller than 8 MB.");
      return;
    }
    setImage(file);
  };

  useEffect(() => {
    if (!image || !isComplaintImageType(image.type)) {
      setIsValidatingImage(false);
      setImageValidationResult(null);
      return;
    }

    const seq = ++imageValidationSeqRef.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsValidatingImage(true);
      try {
        const payload = await readValidationImagePayload(image);
        if (cancelled || seq !== imageValidationSeqRef.current) return;
        const result = await validateComplaintImageApi({
          imageBase64: payload.imageBase64,
          contentType: payload.contentType,
          category: selectedCategory,
          description: description.trim(),
          language: language || "auto",
        });
        if (!cancelled && seq === imageValidationSeqRef.current) {
          setImageValidationResult(result);
        }
      } catch (err) {
        console.warn("Real-time image validation skipped:", err);
        if (!cancelled && seq === imageValidationSeqRef.current) {
          setImageValidationResult(null);
        }
      } finally {
        if (!cancelled && seq === imageValidationSeqRef.current) {
          setIsValidatingImage(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [image, selectedCategory, description, language]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col justify-between text-[#0F172A] dark:text-[#F8FAFC] transition-colors">
      {/* Top Navbar */}
      <GlobalHeader
        subtitle={t("lodgeGrievanceSubtitle", "Citizen Grievance Submission Portal")}
        actions={
          <>
            {user ? (() => {
              let citizenName = user.name && user.name !== "Citizen" && user.name.trim() ? user.name.trim() : "";
              if (!citizenName && typeof window !== "undefined") {
                try {
                  const cleanPhone = (user.mobileNumber || "").replace(/\D/g, "");
                  const cached =
                    localStorage.getItem(`civic_profile_${cleanPhone}`) ||
                    localStorage.getItem(`civic_profile_${user.mobileNumber}`);
                  if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.fullName && parsed.fullName !== "Citizen" && parsed.fullName.trim()) {
                      citizenName = parsed.fullName.trim();
                    }
                  }
                } catch {}
              }
              if (!citizenName) citizenName = user.name?.trim() || "Citizen";

              return (
                <div className="flex items-center gap-2 bg-[#EAF2FF] border border-[#BFDBFE] px-3 py-1.5 rounded-lg text-xs font-medium text-[#0B4EA2]">
                  <div className="w-5 h-5 rounded-full bg-[#0B4EA2] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {citizenName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="font-semibold">{citizenName}</span>
                </div>
              );
            })() : null}

            {user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="text-xs"
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
              >
                {t("logout", "Sign Out")}
              </Button>
            ) : (
              <Link href="/auth/login?redirect=/citizen/complaints/new">
                <Button variant="primary" size="sm" className="text-xs">
                  {t("citizenLogin", "Sign In")}
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Main Form Content */}
      <main className="max-w-3xl w-full mx-auto py-8 px-4 sm:px-6 flex-1">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-4">
          <Link
            href="/"
            className="hover:text-[#0B4EA2] flex items-center gap-1 font-medium transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t("backToHome", "Back to Home")}
          </Link>
          <span>/</span>
          <span className="text-[#0F172A] dark:text-[#F8FAFC] font-semibold">{t("registerComplaint", "New Complaint")}</span>
        </div>


        {/* Complaint Submission Card */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-sm p-6 sm:p-8 transition-colors">
          <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] pb-5 mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B4EA2] bg-[#EAF2FF] px-2.5 py-1 rounded-md mb-2">
              <FileText className="w-3.5 h-3.5" /> {t("lodgeTitle", "File Grievance")}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              {t("formSubmitTitle", "Submit a New Civic Complaint")}
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
              {t("formSubmitSubtitle", "Provide grievance details and incident location to submit to the concerned municipal department.")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                {t("formCategoryLabel", "Grievance Category")} <span className="text-[#DC2626]">*</span>
              </label>
              <select
                name="category"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setVerificationResult(null);
                }}
                required
                className="w-full h-11 px-3.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-sm text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#EAF2FF] dark:focus:ring-[#1E3A8A]"
              >
                <option value="">{t("formCategoryPlaceholder", "Select category...")}</option>
                <option value="waste">{t("catSolidWaste", "Solid Waste / Garbage Disposal")}</option>
                <option value="roads">{t("catRoads", "Potholes & Road Maintenance")}</option>
                <option value="water">{t("catWater", "Water Supply & Leakage")}</option>
                <option value="drainage">{t("catSewage", "Sewage & Drainage Overflow")}</option>
                <option value="streetlights">{t("catStreetlights", "Streetlight Malfunction")}</option>
                <option value="other">{t("catHazardous", "Other Civic Issue")}</option>
              </select>
            </div>

            {/* Description with In-Textarea Whisper Voice Typist & AI Verification */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {t("formDescriptionLabel", "Complaint Description")} <span className="text-[#DC2626]">*</span>
                </label>
                {isVerifying ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#0B4EA2] font-semibold animate-pulse">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Verifying...</span>
                  </span>
                ) : null}
              </div>
              <WhisperVoiceTextarea
                name="description"
                value={description}
                onChange={(newVal) => {
                  setDescription(newVal);
                  if (verificationResult) {
                    setVerificationResult(null);
                  }
                }}
                onBlur={handleVerifyDescription}
                onLanguageDetected={(lang) => setLanguage(lang)}
                disabled={isSubmitting}
                placeholder={t("formDescriptionPlaceholder", "Describe the issue in detail...")}
                required
                rows={5}
              />

              {/* Verification Feedback Banner */}
              {isVerifying ? (
                <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-[#0B4EA2] bg-[#EAF2FF] border border-[#BFDBFE] px-3.5 py-2 rounded-xl">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0B4EA2] shrink-0" />
                  <span>Checking description against selected category...</span>
                </div>
              ) : verificationResult ? (
                verificationResult.status === "verified" ? (
                  <div className="mt-2.5 flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 rounded-xl text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-900">Category Verified</span>
                        <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          {Math.round(verificationResult.confidence * 100)}% match
                        </span>
                      </div>
                      <p className="mt-0.5 text-emerald-700">
                        {verificationResult.message}
                      </p>
                    </div>
                  </div>
                ) : (!verificationResult.is_relevant || verificationResult.status === "invalid") ? (
                  <div className="mt-2.5 flex items-start gap-2.5 bg-red-50 border border-red-300 text-red-900 px-3.5 py-2.5 rounded-xl text-xs shadow-xs">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-950">Invalid Complaint Description</span>
                        <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          Submission Blocked
                        </span>
                      </div>
                      <p className="mt-1 text-red-800 font-medium leading-relaxed">
                        {verificationResult.message}
                      </p>
                      <p className="mt-1.5 text-[11px] text-red-600">
                        CivicResolve accepts grievances regarding public municipal services (roads, garbage, water supply, sewage, or streetlights). Grievance submission is blocked until a valid civic complaint is provided.
                      </p>
                    </div>
                  </div>
                ) : verificationResult.status === "mismatch" ? (
                  <div className="mt-2.5 flex items-start gap-2.5 bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-2.5 rounded-xl text-xs shadow-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-950">Category Mismatch Detected</span>
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          Confidence: {Math.round(verificationResult.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-amber-800">
                        {verificationResult.message}
                      </p>
                      {verificationResult.suggested_category && verificationResult.suggested_category_key && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (verificationResult.suggested_category_key) {
                                setSelectedCategory(verificationResult.suggested_category_key);
                                setVerificationResult({
                                  ...verificationResult,
                                  status: "verified",
                                  message: `Category updated to "${verificationResult.predicted_category}".`,
                                });
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
                          >
                            <span>Switch Category to {verificationResult.predicted_category}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-start gap-2.5 bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-xs">
                    <Info className="w-4 h-4 text-[#0B4EA2] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-[#0F172A]">Officer Review Workflow</span>
                      <p className="mt-0.5 text-slate-600">
                        {verificationResult.message}
                      </p>
                    </div>
                  </div>
                )
              ) : null}
            </div>

            {/* Incident Location: Two Options (Manual Address default, Map after button click) */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <label className="block text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {t("formLocationLabel", "Incident Location")} <span className="text-[#DC2626]">*</span>
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Specify where the civic issue is located
                  </p>
                </div>

                {/* Two Option Toggle Controls */}
                <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] dark:bg-[#161F30] rounded-xl border border-[#CBD5E1] dark:border-[#2D3748] self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowMap(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      !showMap
                        ? "bg-white dark:bg-[#111827] text-[#0B4EA2] dark:text-[#60A5FA] shadow-sm"
                        : "text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                    }`}
                  >
                    <Edit3 size={13} />
                    <span>{t("locationDetails", "Address")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMap(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      showMap
                        ? "bg-[#0B4EA2] dark:bg-[#2563EB] text-white shadow-sm"
                        : "text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                    }`}
                  >
                    <MapPin size={13} />
                    <span>{t("formAdjustMapBtn", "Pin on Map")}</span>
                  </button>
                </div>
              </div>

              {/* Option 1: Manual Address Entry (Default) */}
              {!showMap ? (
                <div className="space-y-3 bg-[#F8FAFC] dark:bg-[#161F30] border border-[#CBD5E1] dark:border-[#2D3748] rounded-2xl p-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                      {t("formEnterAddressPlaceholder", "Address, Street, or Landmark")}
                    </label>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-3.5 top-3 text-[#94A3B8]" />
                      <input
                        type="text"
                        value={resolvedAddress}
                        onChange={(event) => setResolvedAddress(event.target.value)}
                        placeholder={t("formEnterAddressPlaceholder", "Enter Landmark or Street Address")}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#111827] text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#EAF2FF] dark:focus:ring-[#1E3A8A]"
                      />
                    </div>
                  </div>

                  {/* Status badge if already pinned on map */}
                  {location ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl px-3 py-2 text-xs text-[#065F46]">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Check size={14} className="text-[#059669]" />
                        <span>Map Location Pinned: <b>{location.latitude.toFixed(5)}° N, {location.longitude.toFixed(5)}° E</b></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowMap(true)}
                        className="text-[#0B4EA2] hover:underline font-semibold text-[11px]"
                      >
                        Adjust Pin on Map →
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0] text-xs">
                      <span className="text-[#64748B] text-[11px]">
                        Need pinpoint satellite precision? Drop an exact pin on the interactive map.
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMap(true)}
                        className="inline-flex items-center gap-1.5 text-[#0B4EA2] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-colors self-start sm:self-auto shrink-0 shadow-sm"
                      >
                        <MapPin size={13} className="text-[#0B4EA2]" />
                        <span>Pin Location on Map</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Option 2: Interactive Map for Pinpointing Address */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0B4EA2] flex items-center gap-1">
                      <MapPin size={13} />
                      Click on map or drag red marker to pinpoint exact grievance spot
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMap(false)}
                      className="text-xs text-[#64748B] hover:text-[#0F172A] font-semibold underline"
                    >
                      Hide Map
                    </button>
                  </div>

                  <LocationPickerMap
                    initialLatitude={location?.latitude}
                    initialLongitude={location?.longitude}
                    initialAddress={resolvedAddress}
                    onLocationChange={(loc) => {
                      setLocation({
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                      });
                      setResolvedAddress(loc.address);
                    }}
                  />

                  {/* Confirmed / Fine-tuning Address Entry */}
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] mb-1">
                      Confirmed Address or Landmark Notes
                    </label>
                    <input
                      type="text"
                      value={resolvedAddress}
                      onChange={(event) => setResolvedAddress(event.target.value)}
                      placeholder="Add house no, floor, or specific landmark notes..."
                      className="w-full h-10 px-3.5 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0F172A] focus:outline-none focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#EAF2FF]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Photo Evidence Slot with Live Image Preview */}
            <div className="bg-[#F8FAFC] dark:bg-[#161F30] border border-[#CBD5E1] dark:border-[#2D3748] rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-[#0B4EA2]" />
                  <span>{t("formPhotoLabel", "Attach Photo Evidence")}</span>
                </span>
                {image && (
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setImageValidationResult(null);
                      if (imageInput.current) imageInput.current.value = "";
                    }}
                    className="text-xs text-[#DC2626] hover:text-red-700 font-semibold transition-colors"
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              {image && imagePreviewUrl ? (
                /* LIVE PHOTO PREVIEW CARD */
                <div className="relative rounded-xl border border-[#BFDBFE] bg-white p-3.5 flex flex-col sm:flex-row items-center gap-4 shadow-2xs">
                  {/* Thumbnail Image Preview */}
                  <div className="relative w-full sm:w-36 h-40 sm:h-28 rounded-lg overflow-hidden border border-[#CBD5E1] bg-[#F1F5F9] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreviewUrl}
                      alt="Complaint Photo Proof"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* File Metadata & Quick Controls */}
                  <div className="flex-1 min-w-0 w-full space-y-1.5 text-left">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Photo Selected Successfully</span>
                    </div>
                    <p className="text-xs font-semibold text-[#0F172A] truncate" title={image.name}>
                      {image.name}
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      Size: {(image.size / (1024 * 1024)).toFixed(2)} MB • {image.type.replace("image/", "").toUpperCase()}
                    </p>
                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => imageInput.current?.click()}
                        className="text-xs font-semibold text-[#0B4EA2] hover:underline"
                      >
                        Change Photo
                      </button>
                    </div>
                    {isValidatingImage ? (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#1E40AF]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>{t("photoValidating", "Checking photo clarity & relevance...")}</span>
                      </div>
                    ) : imageValidationResult?.status === "VALID" ? (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-xs font-medium text-[#065F46]">
                        <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                        <span>{t("photoValidMsg", "Photo looks good and matches your complaint.")}</span>
                      </div>
                    ) : imageValidationResult?.status === "INVALID" ? (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]">
                        <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p>{t("photoInvalidMsg", "This image does not appear to show the reported civic issue. Please upload a clear photo of the problem.")}</p>
                          {imageValidationResult.reason && (
                            <p className="text-[11px] opacity-85">{imageValidationResult.reason}</p>
                          )}
                        </div>
                      </div>
                    ) : imageValidationResult?.status === "NEEDS_REVIEW" ? (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs font-medium text-[#92400E]">
                        <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p>{t("photoNeedsReviewMsg", "We could not fully verify this image. You may upload a clearer photo or submit for officer review.")}</p>
                          {imageValidationResult.reason && (
                            <p className="text-[11px] opacity-85">{imageValidationResult.reason}</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                /* EMPTY UPLOAD ZONE */
                <div
                  onClick={() => imageInput.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-[#CBD5E1] dark:border-[#2D3748] hover:border-[#0B4EA2] dark:hover:border-[#3B82F6] rounded-xl p-6 text-center transition-all bg-white dark:bg-[#111827] hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#0B4EA2] group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-[#0F172A]">
                    {t("formPhotoLabel", "Click to select or capture photo proof")}
                  </span>
                  <span className="text-[11px] text-[#64748B]">
                    Supports JPEG, PNG, WebP up to 8 MB
                  </span>
                </div>
              )}

              <input
                ref={imageInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleImageSelection(event.target.files?.[0])}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <Link href="/">
                <Button variant="ghost" size="md">
                  {t("modalCancel", "Cancel")}
                </Button>
              </Link>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                rightIcon={<Send className="w-4 h-4" />}
              >
                {isSubmitting ? t("formSubmittingBtn", "Submitting...") : t("formSubmitBtn", "Submit Grievance")}
              </Button>
            </div>
          </form>

          {submissionError && (
            <div role="alert" className="mt-6 p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                <span className="leading-relaxed">{submissionError}</span>
              </div>
              {(submissionError.toLowerCase().includes("session") ||
                submissionError.toLowerCase().includes("token") ||
                submissionError.toLowerCase().includes("sign in")) && (
                <Link href="/auth/login?redirect=/citizen/complaints/new" className="shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs font-bold text-[#B91C1C] border-[#FECACA] bg-white hover:bg-red-50"
                  >
                    Sign In with Mobile OTP
                  </Button>
                </Link>
              )}
            </div>
          )}

          {submittedTrackingNumber && (
            <div className="mt-6 p-4 rounded-xl bg-[#ECFDF3] border border-[#BBF7D0] text-[#15803D] text-sm font-medium flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 text-center sm:text-left">
                <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
                <span>
                  Grievance <strong className="font-mono">{submittedTrackingNumber}</strong> registered successfully.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/complaints/track?id=${encodeURIComponent(submittedTrackingNumber)}`}
                  className="px-3 py-1.5 rounded-lg border border-[#BBF7D0] bg-white text-xs font-bold text-[#15803D] hover:bg-[#F0FDF4] transition-colors"
                >
                  {t("trackStatus", "Track Status")}
                </Link>
                <Link
                  href="/citizen/dashboard"
                  className="px-3 py-1.5 rounded-lg bg-[#15803D] text-white text-xs font-bold hover:bg-[#166534] transition-colors shadow-2xs"
                >
                  {t("myComplaints", "View Dashboard")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-[#0D131F] border-t border-[#E2E8F0] dark:border-[#1E293B] py-4 px-4 text-center text-xs text-[#64748B] dark:text-[#94A3B8] transition-colors">
        CivicResolve • Municipal Services Portal
      </footer>
    </div>
  );
}
