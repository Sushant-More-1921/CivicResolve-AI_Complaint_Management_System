import { getSessionToken } from "../auth/session";
import { API_ROOT } from "./admin";

export interface FieldWorkerRecord {
  id: string;
  name: string;
  phone?: string | null;
  designation: string;
  skills?: string | null;
  departmentId: string;
  department?: { id: string; name: string; code?: string | null };
  availabilityStatus: "AVAILABLE" | "ON_TASK" | "OFF_DUTY";
  status: "ACTIVE" | "INACTIVE";
  _count?: { taskAssignments: number };
  createdAt: string;
}

export interface EvidenceRecord {
  id: string;
  complaintId: string;
  taskId?: string | null;
  uploadedByOfficerId: string;
  uploadedByOfficer?: { id: string; name?: string | null; designation?: string | null };
  stage: "BEFORE" | "IN_PROGRESS" | "AFTER";
  fileUrl: string;
  caption?: string | null;
  verified: boolean;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface FieldTaskRecord {
  id: string;
  complaintId: string;
  departmentId: string;
  officerId: string;
  title: string;
  instructions?: string | null;
  progressNote?: string | null;
  status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  dueDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  complaint?: {
    id: string;
    trackingNumber: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    location: string;
  };
  officer?: {
    id: string;
    name?: string | null;
    phoneNumber: string;
    designation?: string | null;
  };
  workers: Array<{
    id: string;
    fieldWorkerId: string;
    fieldWorker: FieldWorkerRecord;
  }>;
  evidence?: EvidenceRecord[];
}

export interface OfficerDashboardSummary {
  department: { id: string; name: string; code?: string | null } | null;
  assignedTotal: number;
  inProgress: number;
  resolved: number;
  activeTasks: number;
  availableWorkers: number;
}

function authHeaders(explicitToken?: string): HeadersInit {
  const token = explicitToken || getSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function parseJson(res: Response) {
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Request failed with status ${res.status}`);
  }
  return json;
}

export async function fetchOfficerDashboardApi(token?: string): Promise<OfficerDashboardSummary> {
  const res = await fetch(`${API_ROOT}/officer/dashboard`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const json = await parseJson(res);
  return json.data;
}

export async function fetchOfficerComplaintsApi(token?: string): Promise<any[]> {
  const res = await fetch(`${API_ROOT}/officer/complaints`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const json = await parseJson(res);
  return json.data || [];
}

export async function fetchOfficerFieldWorkersApi(token?: string): Promise<FieldWorkerRecord[]> {
  const res = await fetch(`${API_ROOT}/officer/field-workers`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const json = await parseJson(res);
  return json.data || [];
}

export async function fetchOfficerTasksApi(complaintId?: string, token?: string): Promise<FieldTaskRecord[]> {
  const qs = complaintId ? `?complaintId=${encodeURIComponent(complaintId)}` : "";
  const res = await fetch(`${API_ROOT}/officer/tasks${qs}`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const json = await parseJson(res);
  return json.data || [];
}

export async function createOfficerTaskApi(
  payload: {
    complaintId: string;
    title: string;
    instructions?: string;
    dueDate?: string;
    workerIds: string[];
  },
  token?: string
): Promise<FieldTaskRecord> {
  const res = await fetch(`${API_ROOT}/officer/tasks`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  return json.data;
}

export async function updateOfficerTaskApi(
  taskId: string,
  payload: {
    title?: string;
    instructions?: string;
    progressNote?: string;
    status?: FieldTaskRecord["status"];
    workerIds?: string[];
  },
  token?: string
): Promise<FieldTaskRecord> {
  const res = await fetch(`${API_ROOT}/officer/tasks/${taskId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  return json.data;
}

export async function uploadComplaintEvidenceApi(
  complaintId: string,
  payload: {
    taskId?: string;
    stage: "BEFORE" | "IN_PROGRESS" | "AFTER";
    fileUrl?: string;
    imageBase64?: string;
    imageContentType?: "image/jpeg" | "image/png" | "image/webp";
    caption?: string;
  },
  token?: string
): Promise<EvidenceRecord> {
  const res = await fetch(`${API_ROOT}/officer/complaints/${complaintId}/evidence`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  return json.data;
}

export async function verifyEvidenceApi(evidenceId: string, token?: string): Promise<EvidenceRecord> {
  const res = await fetch(`${API_ROOT}/officer/evidence/${evidenceId}/verify`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  const json = await parseJson(res);
  return json.data;
}

export async function fetchMyNotificationsApi(token?: string) {
  const res = await fetch(`${API_ROOT}/users/notifications`, {
    headers: authHeaders(token),
    cache: "no-store",
  });
  const json = await parseJson(res);
  return { unreadCount: json.unreadCount || 0, data: json.data || [] };
}

export async function markNotificationReadApi(id: string | "all", token?: string) {
  const res = await fetch(`${API_ROOT}/users/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  return parseJson(res);
}

export async function clearAllNotificationsApi(token?: string) {
  const res = await fetch(`${API_ROOT}/users/notifications`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return parseJson(res);
}

