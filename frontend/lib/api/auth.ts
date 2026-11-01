/**
 * Authentication API Service
 * Connects directly to backend /api/v1/auth endpoints.
 */

import {
  SendOtpResponse,
  VerifyOtpResponse,
  AuthUser,
} from "@/types/auth";
import { isValidIndianMobile, maskMobileNumber } from "@/lib/validations/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Standard simulated delay for smooth UX loading states when backend is offline
 */
const simulateDelay = (ms = 750) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send real OTP to a Citizen mobile number via backend API.
 */
export async function sendOtpApi(mobileNumber: string): Promise<SendOtpResponse> {
  let cleanNumber = mobileNumber.replace(/\D/g, "");
  if (cleanNumber === "83080934906") cleanNumber = "8380934906";

  if (!isValidIndianMobile(cleanNumber)) {
    throw new Error("Invalid mobile number. Must be a 10-digit Indian number starting with 6-9.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: cleanNumber }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to send OTP. Please try again.");
  }

  return {
    success: true,
    message: data.message || `OTP sent successfully to ${maskMobileNumber(cleanNumber)}`,
    expiresInSeconds: data.expiresInSeconds || 300,
    maskedMobile: maskMobileNumber(cleanNumber),
    otpSessionId: data.otpSessionId,
    devOtpHint: data.devOtpHint,
  };
}

/**
 * Verify Citizen 6-digit OTP against backend database.
 */
export async function verifyOtpApi(
  mobileNumber: string,
  otp: string,
  otpSessionId?: string
): Promise<VerifyOtpResponse> {
  let cleanNumber = mobileNumber.replace(/\D/g, "");
  if (cleanNumber === "83080934906") cleanNumber = "8380934906";
  const cleanOtp = otp.trim();

  if (cleanOtp.length !== 6) {
    throw new Error("Verification code must be exactly 6 digits.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumber: cleanNumber,
      otp: cleanOtp,
      otpSessionId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Invalid or expired OTP code.");
  }

  const authUser: AuthUser = {
    id: data.user.id,
    mobileNumber: data.user.phoneNumber,
    role: data.user.role || "CITIZEN",
    name: data.user.name || "",
    email: data.user.email || "",
    district: data.user.district || "Kolhapur",
    ward: data.user.ward || "",
    address: data.user.address || "",
    pincode: data.user.pincode || "",
    isVerified: true,
    profileCompleted: data.isNewUser === false,
    createdAt: data.user.createdAt || new Date().toISOString(),
  };

  const isNew = Boolean(data.isNewUser);

  return {
    success: true,
    message: data.message || "Mobile number verified successfully.",
    token: data.token,
    isNewUser: isNew,
    user: authUser,
  };
}

/**
 * Update citizen profile details (Name, Address, Ward, Pincode, Email)
 */
export async function updateCitizenProfileApi(
  token: string,
  profile: {
    name: string;
    email?: string;
    district?: string;
    ward?: string;
    address?: string;
    pincode?: string;
  }
): Promise<{ success: boolean; message: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profile),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update profile details.");
  }

  const updatedUser: AuthUser = {
    id: data.data.id,
    mobileNumber: data.data.phoneNumber,
    role: data.data.role || "CITIZEN",
    name: data.data.name || "",
    email: data.data.email || "",
    district: data.data.district || "Kolhapur",
    ward: data.data.ward || "",
    address: data.data.address || "",
    pincode: data.data.pincode || "",
    isVerified: true,
    profileCompleted: true,
    createdAt: data.data.createdAt,
  };

  return {
    success: true,
    message: data.message || "Citizen profile saved successfully.",
    user: updatedUser,
  };
}

/**
 * Delete citizen account and purge personal records permanently
 */
export async function deleteCitizenAccountApi(
  token: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/users/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to delete account.");
  }

  return {
    success: true,
    message: data.message || "Account deleted successfully.",
  };
}

/**
 * Resend Citizen OTP.
 */
export async function resendOtpApi(mobileNumber: string): Promise<SendOtpResponse> {
  return sendOtpApi(mobileNumber);
}

/**
 * Register a new Citizen via backend API.
 */
export async function registerCitizenApi(data: {
  phoneNumber: string;
  name?: string;
  email?: string;
}): Promise<{ success: boolean; message: string; data: { id: string } }> {
  const cleanNumber = data.phoneNumber.replace(/\D/g, "");

  if (!isValidIndianMobile(cleanNumber)) {
    throw new Error("Invalid mobile number. Must be a 10-digit Indian number starting with 6-9.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumber: cleanNumber,
      name: data.name,
      email: data.email,
    }),
  });

  const resData = await res.json();
  if (!res.ok) {
    throw new Error(resData.message || "Registration failed.");
  }

  return resData;
}

/**
 * Send OTP for Administrator Login (verified against authorized directory).
 */
export async function sendAdminOtpApi(mobileNumber: string): Promise<SendOtpResponse> {
  let cleanNumber = mobileNumber.replace(/\D/g, "");
  if (cleanNumber === "83080934906") cleanNumber = "8380934906";

  if (!isValidIndianMobile(cleanNumber)) {
    throw new Error("Invalid administrative mobile number. Must be a 10-digit Indian number.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/admin/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: cleanNumber }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Admin authentication failed. Unauthorized number.");
  }
  return {
    success: true,
    message: data.message || `Security OTP sent to Authorized Officer ${maskMobileNumber(cleanNumber)}`,
    expiresInSeconds: data.expiresInSeconds || 300,
    maskedMobile: maskMobileNumber(cleanNumber),
    otpSessionId: data.otpSessionId,
  };
}

/**
 * Verify Administrator OTP against backend database.
 */
export async function verifyAdminOtpApi(
  mobileNumber: string,
  otp: string,
  otpSessionId?: string
): Promise<VerifyOtpResponse> {
  let cleanNumber = mobileNumber.replace(/\D/g, "");
  if (cleanNumber === "83080934906") cleanNumber = "8380934906";
  const cleanOtp = otp.trim();

  if (cleanOtp.length !== 6) {
    throw new Error("Administrative 2FA code must be exactly 6 digits.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/admin/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumber: cleanNumber,
      otp: cleanOtp,
      otpSessionId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Invalid Admin OTP credentials.");
  }

  const authUser: AuthUser = {
    id: data.user.id,
    mobileNumber: data.user.phoneNumber,
    role: data.user.role || "ADMIN",
    name: data.user.name || "Administrator",
    designation: data.user.designation || "Grievance Officer",
    department: data.user.department?.name || data.user.departmentName,
    isVerified: true,
    createdAt: data.user.createdAt || new Date().toISOString(),
  };

  return {
    success: true,
    message: data.message || "Administrative clearance verified successfully.",
    token: data.token,
    user: authUser,
  };
}

/**
 * Resend Admin OTP.
 */
export async function resendAdminOtpApi(mobileNumber: string): Promise<SendOtpResponse> {
  return sendAdminOtpApi(mobileNumber);
}

/**
 * Fetch authenticated user profile from backend.
 */
export async function getUserProfileApi(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/users/profile`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        return {
          id: json.data.id,
          mobileNumber: json.data.phoneNumber,
          role: json.data.role || "CITIZEN",
          name: json.data.name || "",
          email: json.data.email || "",
          district: json.data.district || "Kolhapur",
          ward: json.data.ward || "",
          address: json.data.address || "",
          pincode: json.data.pincode || "",
          profileCompleted: json.data.profileCompleted,
          isVerified: true,
          createdAt: json.data.createdAt,
        };
      }
    }
  } catch (e) {
    console.warn("Error fetching user profile:", e);
  }

  return null;
}

