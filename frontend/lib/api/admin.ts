/**
 * Admin & Officer API Client
 * Facilitates direct connection with backend /api/v1/admin endpoints.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface DepartmentItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  headOfficerName?: string | null;
}

export interface OfficerItem {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
  designation?: string | null;
  badgeId?: string | null;
  departmentId?: string | null;
  activeCases: number;
  resolvedCases: number;
  avgResolutionHours?: number | null;
  rating?: number | null;
  isAvailable: boolean;
  createdAt: string;
  role?: string;
  district?: string;
  department?: DepartmentItem | null;
}

export interface AddOfficerPayload {
  name: string;
  phoneNumber: string;
  email?: string;
  designation?: string;
  departmentId?: string;
  badgeId?: string;
  role?: "OFFICER" | "ADMIN";
  division?: string;
  isAvailable?: boolean;
}

export interface AddOfficerResponse {
  success: boolean;
  message: string;
  data: OfficerItem;
}

/**
 * Fetch all municipal departments directly from database
 */
export async function fetchDepartmentsApi(): Promise<DepartmentItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/departments`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load departments");
    }
    return json.data || [];
  } catch (error: any) {
    console.error("fetchDepartmentsApi error:", error);
    throw error;
  }
}

/**
 * Fetch all registered officers & administrators from database
 */
export async function fetchOfficersApi(): Promise<OfficerItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/officers`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load officers");
    }
    return json.data || [];
  } catch (error: any) {
    console.error("fetchOfficersApi error:", error);
    throw error;
  }
}

/**
 * Register a new Officer or Administrator into database
 */
export async function addOfficerApi(payload: AddOfficerPayload): Promise<AddOfficerResponse> {
  const cleanPhone = payload.phoneNumber.replace(/\D/g, "");

  if (cleanPhone.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/admin/officers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      phoneNumber: cleanPhone,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to register officer in database.");
  }

  return json;
}

/**
 * Remove an officer by ID from active roster
 */
export async function deleteOfficerApi(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/officers/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to delete officer");
  }

  return json;
}

export interface DistrictStatItem {
  divisionId: string;
  divisionName: string;
  districts: string[];
  headquarters: string;
  totalComplaints: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  criticalComplaints: number;
  resolutionRate: number;
  assignedOfficers: number;
}

export interface DistrictStatsData {
  totalComplaints: number;
  totalResolved: number;
  totalPending: number;
  avgResolutionRate: number;
  districts: DistrictStatItem[];
}

/**
 * Fetch complaint breakdown across Maharashtra districts for Super Admin
 */
export async function fetchDistrictStatsApi(): Promise<DistrictStatsData> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/stats/districts`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || "Failed to load district complaint stats");
    }
    return json.data;
  } catch (error: any) {
    console.error("fetchDistrictStatsApi error:", error);
    throw error;
  }
}

