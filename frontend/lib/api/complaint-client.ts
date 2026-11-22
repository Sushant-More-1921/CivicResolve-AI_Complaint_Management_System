import { getSessionToken, clearSession } from "@/lib/auth/session";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");
const API_ROOT = API_BASE_URL.endsWith("/api/v1")
  ? API_BASE_URL
  : `${API_BASE_URL}/api/v1`;

export interface CreateComplaintRequest {
  description: string;
  category: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  language?: "en" | "hi" | "mr";
  imageBase64?: string;
  imageContentType?: "image/jpeg" | "image/png" | "image/webp";
}

export interface BackendTimelineEntry {
  status: BackendComplaintStatus;
  note: string;
  author: string;
  createdAt: string;
}

export type BackendComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "REJECTED";

export interface TrackedComplaint {
  id: string;
  trackingNumber: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string | null;
  divisionId?: string;
  divisionName?: string;
  districtId?: string;
  districtName?: string;
  authorityId?: string;
  authorityName?: string;
  departmentId?: string | null;
  department?: { name: string } | null;
  location: string;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: BackendComplaintStatus;
  priority: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
  assignedOfficerName?: string | null;
  assignedOfficerId?: string | null;
  citizen?: { name?: string | null; phoneNumber?: string } | null;
  createdAt: string;
  updatedAt: string;
  imageUrl?: string | null;
  aiConfidence?: number | null;
  aiSuggestedCategory?: string | null;
  aiReasoning?: string | null;
  slaHours?: number;
  slaDeadline?: string;
  timeline?: BackendTimelineEntry[];
  resolutionRemarks?: string | null;
  resolutionImageUrl?: string | null;
}

export function getMyComplaintsApi(): Promise<TrackedComplaint[]> {
  return apiRequest<TrackedComplaint[]>("/complaints/my", {}, true);
}

export interface VoiceTranscriptionResponse {
  text: string;
  language: "en" | "hi" | "mr";
  analysis: Record<string, unknown>;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  requiresAuth = false
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (requiresAuth) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not connect to CivicResolve. Please try again.");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      const message =
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string" &&
        !payload.message.toLowerCase().includes("invalid token")
          ? payload.message
          : "Your session has expired. Please sign in again.";
      const error = new Error(message) as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed (${response.status}).`;
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = response.status;
    throw error;
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload)
  ) {
    throw new Error("The backend returned an invalid response.");
  }
  return payload.data as T;
}

export function submitComplaintApi(
  complaint: CreateComplaintRequest
): Promise<TrackedComplaint> {
  return apiRequest<TrackedComplaint>(
    "/complaints",
    { method: "POST", body: JSON.stringify(complaint) },
    true
  );
}

export function transcribeComplaintAudioApi(
  audio: File
): Promise<VoiceTranscriptionResponse> {
  const body = new FormData();
  body.append("audio", audio);
  return apiRequest<VoiceTranscriptionResponse>(
    "/ai/voice/transcribe",
    { method: "POST", body },
    false
  );
}

export function trackComplaintApi(
  trackingNumber: string
): Promise<TrackedComplaint> {
  return apiRequest<TrackedComplaint>(
    `/complaints/track/${encodeURIComponent(trackingNumber)}`
  );
}

export interface VerifyComplaintDescriptionRequest {
  description: string;
  selected_category?: string | null;
  language?: string;
}

export interface VerifyComplaintDescriptionResponse {
  is_relevant: boolean;
  predicted_category: string | null;
  confidence: number;
  status: "verified" | "mismatch" | "review_required" | "invalid";
  message: string;
  suggested_category?: string | null;
  suggested_category_key?: string | null;
}

export function verifyComplaintDescriptionApi(
  payload: VerifyComplaintDescriptionRequest
): Promise<VerifyComplaintDescriptionResponse> {
  return apiRequest<VerifyComplaintDescriptionResponse>(
    "/complaints/verify-description",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false
  );
}

export interface ValidateComplaintImageRequest {
  imageBase64: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  category: string;
  description: string;
  language?: "en" | "hi" | "mr" | "auto";
}

export interface ValidateComplaintImageResponse {
  status: "VALID" | "INVALID" | "NEEDS_REVIEW";
  category_match: boolean;
  description_match: boolean;
  image_quality: "good" | "low_quality";
  reason: string;
  requires_manual_review: boolean;
  duplicate_detected: boolean;
}

export function validateComplaintImageApi(
  payload: ValidateComplaintImageRequest
): Promise<ValidateComplaintImageResponse> {
  return apiRequest<ValidateComplaintImageResponse>(
    "/complaints/validate-image",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    false
  );
}
