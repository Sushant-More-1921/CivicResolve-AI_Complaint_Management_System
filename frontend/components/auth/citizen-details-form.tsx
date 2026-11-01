"use client";

import React, { useState, useMemo } from "react";
import { User, MapPin, Mail, Home, Hash, ShieldCheck, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { updateCitizenProfileApi } from "@/lib/api/auth";
import { saveSession, getSessionToken } from "@/lib/auth/session";
import { AuthUser } from "@/types/auth";

interface CitizenDetailsFormProps {
  user: AuthUser;
  token: string;
  onCompleted: (updatedUser: AuthUser) => void;
}

/**
 * 4 Main Administrative Divisions of Maharashtra (+ others)
 */
export const MAHARASHTRA_DIVISIONS = [
  "Pune",
  "Nashik",
  "Konkan (Mumbai)",
  "Chhatrapati Sambhajinagar",
  "Nagpur",
  "Amravati",
];

export function CitizenDetailsForm({ user, token, onCompleted }: CitizenDetailsFormProps) {
  const [name, setName] = useState(user.name && user.name !== "Verified Citizen" ? user.name : "");
  const [email, setEmail] = useState(user.email || "");
  const [district, setDistrict] = useState(user.district || MAHARASHTRA_DIVISIONS[0]);
  const [address, setAddress] = useState(user.address || "");
  const [pincode, setPincode] = useState(user.pincode || "");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const divisionOptions = useMemo(() => {
    if (user.district && !MAHARASHTRA_DIVISIONS.includes(user.district)) {
      return [user.district, ...MAHARASHTRA_DIVISIONS];
    }
    return MAHARASHTRA_DIVISIONS;
  }, [user.district]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      setErrorMessage("Please enter your legal name (at least 2 characters).");
      return;
    }

    const cleanAddress = address.trim();
    if (!cleanAddress || cleanAddress.length < 2) {
      setErrorMessage("Please enter your residential address manually.");
      return;
    }

    const cleanPincode = pincode.trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      setErrorMessage("Please enter a valid 6-digit postal pincode manually (e.g. 411001).");
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address or leave it blank.");
      return;
    }

    setIsLoading(true);
    try {
      const activeToken = token || getSessionToken() || "";
      const result = await updateCitizenProfileApi(activeToken, {
        name: cleanName,
        email: email.trim() || undefined,
        district,
        address: cleanAddress,
        pincode: cleanPincode,
      });

      // Update session in localStorage
      saveSession(activeToken, result.user);

      // Keep legacy cache synced
      if (typeof window !== "undefined") {
        const cleanPhone = (user.mobileNumber || result.user.mobileNumber).replace(/\D/g, "");
        const profileObj = {
          fullName: result.user.name || cleanName,
          email: result.user.email || email.trim(),
          district: result.user.district || district,
          address: result.user.address || cleanAddress,
          pincode: result.user.pincode || cleanPincode,
          aadhaarMasked: `XXXX-XXXX-${cleanPhone.slice(-4) || "4819"}`,
          smsAlerts: true,
        };
        localStorage.setItem(`civic_profile_${cleanPhone}`, JSON.stringify(profileObj));
        localStorage.setItem(`civic_profile_${user.mobileNumber}`, JSON.stringify(profileObj));
      }

      // Notify parent to proceed
      onCompleted(result.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save citizen details. Please retry.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8">
        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF2FF] text-[#0B4EA2]">
            <ShieldCheck className="w-3.5 h-3.5" />
            Citizen Identity Verified
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          Citizen Details
        </h2>

        {errorMessage && (
          <div className="mb-5">
            <Alert variant="danger" title="Action Required">
              {errorMessage}
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Verified Mobile Number (Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-1.5">
              Verified Mobile Number
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded-xl text-sm font-medium text-[#334155]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{user.mobileNumber || "Authenticated"}</span>
              <span className="ml-auto text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                OTP Verified
              </span>
            </div>
          </div>

          {/* Full Name with generic placeholder */}
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1.5">
              Full Legal Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Citizen Name"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CBD5E1] focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#0B4EA2]/10 rounded-xl text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-none"
              />
            </div>
          </div>

          {/* Email Address with generic placeholder */}
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1.5">
              Email Address 
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. citizen@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CBD5E1] focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#0B4EA2]/10 rounded-xl text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-none"
              />
            </div>
          </div>

          {/* District / Division Selection Dropdown (Pune, Nashik, Konkan, Chhatrapati Sambhajinagar, etc.) */}
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1.5">
              District / Division (Maharashtra) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#CBD5E1] focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#0B4EA2]/10 rounded-xl text-sm font-medium text-[#0F172A] transition-all outline-none cursor-pointer"
              >
                {divisionOptions.map((div) => (
                  <option key={div} value={div}>
                    {div}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Residential Address (Manual Entry - No list of address, no prerequisites) */}
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1.5">
              Residential Address<span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Home className="absolute left-3.5 top-3 w-4 h-4 text-[#94A3B8]" />
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. House / Flat No., Street Name, Locality"
                className="w-full pl-10 pr-4 py-2 bg-white border border-[#CBD5E1] focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#0B4EA2]/10 rounded-xl text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-none resize-none"
              />
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">
              Enter your street, house or locality manually.
            </p>
          </div>

          {/* Postal Pincode (Manual Entry) */}
          <div>
            <label className="block text-xs font-semibold text-[#1E293B] uppercase tracking-wider mb-1.5">
              Postal Pincode<span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="e.g. 411001"
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#CBD5E1] focus:border-[#0B4EA2] focus:ring-2 focus:ring-[#0B4EA2]/10 rounded-xl text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] transition-all outline-none"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full justify-center text-sm font-semibold py-3 shadow-md bg-[#0B4EA2] hover:bg-[#083B7A] text-white rounded-xl"
              disabled={isLoading}
              rightIcon={
                isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )
              }
            >
              {isLoading ? "Saving Profile..." : "Save Details & Open Dashboard"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
