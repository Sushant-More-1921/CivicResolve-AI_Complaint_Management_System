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

const RAW_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const API_ROOT = RAW_API_URL.endsWith("/api/v1")
  ? RAW_API_URL
  : `${RAW_API_URL}/api/v1`;

async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Server request failed with status ${res.status}. Please check your connection.`);
    }
    throw new Error("Server returned an invalid response format. Please try again.");
  }
  return json as T;
}

/**
 * Send real OTP to a Citizen mobile number via backend API.
 */
export async function sendOtpApi(mobileNumber: string): Promise<SendOtpResponse> {
  let cleanNumber = mobileNumber.replace(/\D/g, "");
  if (cleanNumber === "83080934906") cleanNumber = "8380934906";

  if (!isValidIndianMobile(cleanNumber)) {
    throw new Error("Invalid mobile number. Must be a 10-digit Indian number starting with 6-9.");
  }

  const res = await fetch(`${API_ROOT}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: cleanNumber }),
  });

  const data = await parseJsonResponse(res);
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

  const res = await fetch(`${API_ROOT}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumber: cleanNumber,
      otp: cleanOtp,
      otpSessionId,
    }),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.message || "Invalid or expired OTP code.");
  }

  const normalizedRole = data.user.role === "ADMIN" ? "DEPARTMENT_ADMIN" : (data.user.role || "CITIZEN");

  const authUser: AuthUser = {
    id: data.user.id,
    mobileNumber: data.user.phoneNumber,
    role: normalizedRole,
    name: data.user.name || "",
    email: data.user.email || "",
    district: data.user.district || "Kolhapur",
    ward: data.user.ward || "",
    address: data.user.address || "",
    pincode: data.user.pincode || "",
    designation: data.user.designation || undefined,
    department: data.user.department?.name || data.user.departmentName || data.user.department || undefined,
    departmentId: data.user.departmentId || null,
    departmentName: data.user.department?.name || data.user.departmentName || null,
    officerId: data.user.officerId || null,
    badgeId: data.user.badgeId || undefined,
    isVerified: true,
    profileCompleted: normalizedRole === "CITIZEN" ? data.isNewUser === false : true,
    createdAt: data.user.createdAt || new Date().toISOString(),
  };

  const isNew = normalizedRole === "CITIZEN" && Boolean(data.isNewUser);

  return {
    success: true,
    message: data.message || "Mobile number verified successfully.",
    token: data.token,
    isNewUser: isNew,
    redirectTo: data.redirectTo,
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
    websiteNotifications?: boolean;
    smsNotifications?: boolean;
    notifyStatusChange?: boolean;
    notifyResolution?: boolean;
    notifyInfoRequest?: boolean;
  }
): Promise<{ success: boolean; message: string; user: AuthUser }> {
  const res = await fetch(`${API_ROOT}/users/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profile),
  });

  const data = await parseJsonResponse(res);
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
    websiteNotifications: data.data.websiteNotifications ?? true,
    smsNotifications: data.data.smsNotifications ?? true,
    notifyStatusChange: data.data.notifyStatusChange ?? true,
    notifyResolution: data.data.notifyResolution ?? true,
    notifyInfoRequest: data.data.notifyInfoRequest ?? true,
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
  const res = await fetch(`${API_ROOT}/users/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJsonResponse(res);
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

  const res = await fetch(`${API_ROOT}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumber: cleanNumber,
      name: data.name,
      email: data.email,
    }),
  });

  const resData = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(resData.message || "Registration failed.");
  }

  return resData;
}

/**
 * Fetch authenticated user profile from backend.
 */
export async function getUserProfileApi(token: string): Promise<AuthUser | null> {
  if (!token) return null;

  try {
    const res = await fetch(`${API_ROOT}/users/profile`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const json = await parseJsonResponse(res);
      if (json && json.data) {
        return {
          id: json.data.id,
          mobileNumber: json.data.phoneNumber,
          role: json.data.role === "ADMIN" ? "DEPARTMENT_ADMIN" : (json.data.role || "CITIZEN"),
          name: json.data.name || "",
          email: json.data.email || "",
          designation: json.data.designation || undefined,
          departmentId: json.data.departmentId || null,
          departmentName: json.data.departmentName || json.data.department?.name || null,
          department: json.data.departmentName || json.data.department?.name || undefined,
          officerId: json.data.officerId || null,
          badgeId: json.data.badgeId || undefined,
          district: json.data.district || "Kolhapur",
          ward: json.data.ward || "",
          address: json.data.address || "",
          pincode: json.data.pincode || "",
          websiteNotifications: json.data.websiteNotifications ?? true,
          smsNotifications: json.data.smsNotifications ?? true,
          notifyStatusChange: json.data.notifyStatusChange ?? true,
          notifyResolution: json.data.notifyResolution ?? true,
          notifyInfoRequest: json.data.notifyInfoRequest ?? true,
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
