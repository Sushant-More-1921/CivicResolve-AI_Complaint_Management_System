/**
 * Admin & Officer API Client
 * Facilitates direct connection with backend /api/v1/admin endpoints.
 */

import { getSessionToken } from "../auth/session";

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
      throw new Error(`Server request failed with status ${res.status}.`);
    }
    throw new Error("Server returned an invalid response format.");
  }
  return json as T;
}

function getAuthHeaders(explicitToken?: string): HeadersInit {
  const token = explicitToken || getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  headOfficerName?: string | null;
  primaryAdminId?: string | null;
  status?: string;
  primaryAdmin?: {
    id: string;
    name?: string | null;
    phoneNumber: string;
    email?: string | null;
    designation?: string | null;
    isActive: boolean;
  } | null;
  _count?: { complaints: number; officers: number; fieldWorkers?: number; tasks?: number };
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
  isActive?: boolean;
  userId?: string | null;
  user?: { isActive: boolean } | null;
  _count?: { complaints?: number };
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
  role?: "OFFICER" | "DEPARTMENT_ADMIN" | "ADMIN" | "SUPER_ADMIN";
  division?: string;
  isAvailable?: boolean;
}

export interface AddOfficerResponse {
  success: boolean;
  message: string;
  data: OfficerItem;
}

export interface AuditLogItem {
  id: string;
  complaintId: string;
  trackingNumber?: string;
  complaintTitle?: string;
  category?: string;
  status: string;
  actionType: string;
  note: string;
  author: string;
  authorRole: string;
  timestamp: string;
}

export interface ManagedUserItem {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  role: string;
  designation?: string;
  department?: string;
  district: string;
  complaintsCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface PlatformOverviewData {
  metrics: {
    totalComplaints: number;
    totalUsers: number;
    totalOfficers: number;
    totalDepartments: number;
    systemHealth: string;
    aiServiceStatus: string;
    databaseStatus: string;
    uptimeSeconds: number;
  };
  breakdowns: {
    byCategory: Array<{ category: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
  };
  recentComplaints: any[];
}

/**
 * Fetch all municipal departments directly from database
 */
export async function fetchDepartmentsApi(): Promise<DepartmentItem[]> {
  try {
    const res = await fetch(`${API_ROOT}/admin/departments`, {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store",
    });

    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json?.success) {
      return [];
    }
    return json.data || [];
  } catch (error: any) {
    console.warn("fetchDepartmentsApi notice:", error?.message || error);
    return [];
  }
}

/**
 * Fetch all registered officers & administrators from database
 */
export async function fetchOfficersApi(filters?: { departmentId?: string }, token?: string): Promise<OfficerItem[]> {
  try {
    const qs = filters?.departmentId ? `?departmentId=${encodeURIComponent(filters.departmentId)}` : "";
    const res = await fetch(`${API_ROOT}/admin/officers${qs}`, {
      method: "GET",
      headers: getAuthHeaders(token),
      cache: "no-store",
    });

    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json?.success) {
      return [];
    }
    return json.data || [];
  } catch (error: any) {
    console.warn("fetchOfficersApi notice:", error?.message || error);
    return [];
  }
}

/**
 * Register a new Officer or Administrator into database
 */
export async function addOfficerApi(payload: AddOfficerPayload, token?: string): Promise<AddOfficerResponse> {
  const cleanPhone = payload.phoneNumber.replace(/\D/g, "");

  if (cleanPhone.length !== 10) {
    throw new Error("Please enter a valid 10-digit mobile number.");
  }

  const res = await fetch(`${API_ROOT}/admin/officers`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({
      ...payload,
      phoneNumber: cleanPhone,
    }),
  });

  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to register officer in database.");
  }

  return json;
}

/**
 * Remove an officer by ID from active roster
 */
export async function deleteOfficerApi(id: string, token?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_ROOT}/admin/officers/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });

  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to delete officer");
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
export async function fetchDistrictStatsApi(token?: string): Promise<DistrictStatsData | null> {
  try {
    const res = await fetch(`${API_ROOT}/admin/stats/districts`, {
      method: "GET",
      headers: getAuthHeaders(token),
      cache: "no-store",
    });

    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json?.success) {
      return null;
    }
    return json.data || null;
  } catch (error: any) {
    console.warn("fetchDistrictStatsApi notice:", error?.message || error);
    return null;
  }
}

/**
 * Super Admin: Fetch Platform Overview & Health Metrics
 */
export async function fetchPlatformOverviewApi(token?: string): Promise<PlatformOverviewData | null> {
  try {
    const res = await fetch(`${API_ROOT}/admin/overview`, {
      method: "GET",
      headers: getAuthHeaders(token),
      cache: "no-store",
    });

    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json?.success) {
      return null;
    }
    return json.data || null;
  } catch (error: any) {
    console.warn("fetchPlatformOverviewApi notice:", error?.message || error);
    return null;
  }
}

/**
 * Super Admin: Fetch System-wide Audit Logs
 */
export async function fetchAuditLogsApi(limit: number = 30, token?: string): Promise<AuditLogItem[]> {
  try {
    const res = await fetch(`${API_ROOT}/admin/audit-logs?limit=${limit}`, {
      method: "GET",
      headers: getAuthHeaders(token),
      cache: "no-store",
    });

    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json?.success) {
      return [];
    }
    return json.data || [];
  } catch (error: any) {
    console.warn("fetchAuditLogsApi notice:", error?.message || error);
    return [];
  }
}

/**
 * Super Admin: Fetch Registered Users & Role Roster
 */
export async function fetchUsersApi(filters?: { role?: string; search?: string }, token?: string): Promise<ManagedUserItem[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.role && filters.role !== "ALL") params.set("role", filters.role);
    if (filters?.search && filters.search.trim()) params.set("search", filters.search.trim());

    const res = await fetch(`${API_ROOT}/admin/users?${params.toString()}`, {
      method: "GET",
      headers: getAuthHeaders(token),
      cache: "no-store",
    });

    const json = await parseJsonResponse<any>(res);
    if (!res.ok || !json?.success) {
      return [];
    }
    return json.data || [];
  } catch (error: any) {
    console.warn("fetchUsersApi notice:", error?.message || error);
    return [];
  }
}

/**
 * Super Admin: Update User Role (CITIZEN | OFFICER | ADMIN | SUPER_ADMIN)
 */
export async function updateUserRoleApi(userId: string, role: string, token?: string): Promise<boolean> {
  const res = await fetch(`${API_ROOT}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ role }),
  });

  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to update user role.");
  }
  return true;
}

export async function updateUserStatusApi(userId: string, isActive: boolean, token?: string): Promise<any> {
  const res = await fetch(`${API_ROOT}/admin/users/${userId}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ isActive }),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to update user status.");
  }
  return json.data;
}

export async function createDepartmentApi(
  payload: { name: string; code?: string; description?: string; contactEmail?: string; contactPhone?: string },
  token?: string
): Promise<DepartmentItem> {
  const res = await fetch(`${API_ROOT}/admin/departments`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to create department.");
  }
  return json.data;
}

export async function updateDepartmentApi(
  id: string,
  payload: Partial<{ name: string; description: string; status: string; contactEmail: string; contactPhone: string }>,
  token?: string
): Promise<DepartmentItem> {
  const res = await fetch(`${API_ROOT}/admin/departments/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to update department.");
  }
  return json.data;
}

export async function fetchDepartmentAdminsApi(token?: string): Promise<any[]> {
  const res = await fetch(`${API_ROOT}/admin/department-admins`, {
    headers: getAuthHeaders(token),
    cache: "no-store",
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) return [];
  return json.data || [];
}

export async function assignOrReplaceDepartmentAdminApi(
  departmentId: string,
  payload: { name: string; phoneNumber: string; email?: string; designation?: string; replaceExisting?: boolean },
  token?: string
): Promise<any> {
  const endpoint = payload.replaceExisting
    ? `${API_ROOT}/admin/departments/${departmentId}/replace-admin`
    : `${API_ROOT}/admin/department-admins`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ ...payload, departmentId }),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to assign Department Admin.");
  }
  return json.data;
}

export async function updateOfficerApi(
  id: string,
  payload: { name?: string; designation?: string; email?: string; isAvailable?: boolean; isActive?: boolean },
  token?: string
): Promise<OfficerItem> {
  const res = await fetch(`${API_ROOT}/admin/officers/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to update officer.");
  }
  return json.data;
}

export async function fetchFieldWorkersApi(departmentId?: string, token?: string): Promise<any[]> {
  const qs = departmentId && departmentId !== "ALL" ? `?departmentId=${encodeURIComponent(departmentId)}` : "";
  const res = await fetch(`${API_ROOT}/admin/field-workers${qs}`, {
    headers: getAuthHeaders(token),
    cache: "no-store",
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) return [];
  return json.data || [];
}

export async function createFieldWorkerApi(
  payload: { name: string; phone?: string; designation?: string; skills?: string; departmentId?: string; availabilityStatus?: string },
  token?: string
): Promise<any> {
  const res = await fetch(`${API_ROOT}/admin/field-workers`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to add field worker.");
  }
  return json.data;
}

export async function updateFieldWorkerApi(
  id: string,
  payload: Partial<{ name: string; phone: string; designation: string; skills: string; availabilityStatus: string; status: string }>,
  token?: string
): Promise<any> {
  const res = await fetch(`${API_ROOT}/admin/field-workers/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to update field worker.");
  }
  return json.data;
}

export async function deleteFieldWorkerApi(id: string, token?: string): Promise<void> {
  const res = await fetch(`${API_ROOT}/admin/field-workers/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(token),
  });
  const json = await parseJsonResponse<any>(res);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || "Failed to remove field worker.");
  }
}
