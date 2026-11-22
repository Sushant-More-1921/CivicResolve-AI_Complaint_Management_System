/**
 * CivicResolve Incident Database & Relational Repository
 *
 * All dashboard metrics are dynamically computed from this store.
 * Synchronizes with Supabase / PostgreSQL backend via /api/v1/complaints.
 * Never hardcodes counts or uses mock fake complaints.
 */

import {
  MasterIncident,
  CitizenReport,
  DashboardStats,
  IncidentFilterParams,
  MapIncidentItem,
  MapClusterItem,
  MapHotspotItem,
} from "@/types/incident";
import { Complaint, ComplaintPriority, ComplaintStatus, CitizenFeedback } from "@/types/complaint";
import {
  evaluateReportMatch,
  recalculateIncidentPriority,
  calculateHaversineDistance,
} from "@/lib/clustering/clustering-engine";
import { emitRealTimeEvent } from "@/lib/realtime/events";
import { getAllComplaintsAdminApi } from "@/lib/api/complaints";
import { getSessionToken } from "@/lib/auth/session";

const STORAGE_KEY = "civicresolve_incidents_db_v2";

// In-Memory Storage Cache (Singleton across requests)
let cachedIncidents: MasterIncident[] = [];

/**
 * Adapter converting raw backend complaint (or Complaint interface) to MasterIncident
 */
export function backendComplaintToIncident(raw: any): MasterIncident {
  const createdDate = raw.createdAt ? new Date(raw.createdAt) : new Date();
  const updatedDate = raw.updatedAt ? new Date(raw.updatedAt) : createdDate;
  const lat = typeof raw.latitude === "number"
    ? raw.latitude
    : (raw.coordinates?.lat || 0);
  const lng = typeof raw.longitude === "number"
    ? raw.longitude
    : (raw.coordinates?.lng || 0);

  const trackingNumber = raw.trackingNumber || raw.incidentNumber || raw.id;
  const citizenName = raw.citizen?.name || raw.citizenName || "Verified Citizen";
  const citizenMobile = raw.citizen?.phoneNumber || raw.citizenMobile || "+91 98220 00000";

  const supportingReports: CitizenReport[] = [
    {
      id: `rep-${raw.id}`,
      trackingNumber,
      citizenName,
      citizenMobile,
      description: raw.description || "",
      location: raw.location || "Maharashtra",
      coordinates: { lat, lng },
      imageUrl: raw.imageUrl || undefined,
      reportedAt: createdDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: createdDate.getTime(),
      channel: "WEB_PORTAL",
      aiConfidence: raw.aiConfidence || 95,
    },
  ];

  const timelineEvents = Array.isArray(raw.timeline) && raw.timeline.length > 0
    ? raw.timeline.map((t: any) => ({
        status: (t.status || "SUBMITTED") as ComplaintStatus,
        timestamp: t.createdAt
          ? new Date(t.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Just now",
        note: t.note || "Status updated",
        author: t.author || "System Authority",
      }))
    : [
        {
          status: (raw.status || "SUBMITTED") as ComplaintStatus,
          timestamp: createdDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
          note: "Grievance received and cataloged in central registry.",
          author: "Citizen Intake",
        },
      ];

  const slaDeadlineStr = raw.slaDeadline
    ? new Date(raw.slaDeadline).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "SLA Active";

  const deptName = raw.department?.name || raw.departmentName || (typeof raw.department === "string" ? raw.department : "Municipal Public Works");

  return {
    id: raw.id,
    incidentNumber: trackingNumber,
    title: raw.title || (raw.description ? (raw.description.slice(0, 70) + (raw.description.length > 70 ? "..." : "")) : "Civic Grievance"),
    description: raw.description || "",
    category: raw.category || "General Municipal Services",
    subcategory: raw.subcategory || raw.subCategory || undefined,
    divisionId: raw.divisionId || "div-kolhapur",
    divisionName: raw.divisionName || "Kolhapur Division",
    districtId: raw.districtId || "dist-kolhapur",
    districtName: raw.districtName || "Kolhapur District",
    authorityId: raw.authorityId || "auth-kmc",
    authorityName: raw.authorityName || "Kolhapur Municipal Corporation (KMC)",
    departmentId: raw.departmentId || raw.department?.id || "dept-kmc-general",
    departmentName: deptName,
    department: deptName,
    location: raw.location || "Maharashtra",
    region: raw.divisionName || "Central Zone",
    coordinates: { lat, lng },
    status: (raw.status || "SUBMITTED") as ComplaintStatus,
    priority: (raw.priority || "MEDIUM") as ComplaintPriority,
    assignedOfficer: raw.assignedOfficerName || raw.assignedOfficer?.name || (typeof raw.assignedOfficer === "string" ? raw.assignedOfficer : undefined),
    assignedOfficerId: raw.assignedOfficerId || undefined,
    complaintCount: 1,
    supportingReports,
    firstReportedAt: createdDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    lastReportedAt: updatedDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAtTimestamp: createdDate.getTime(),
    lastReportedTimestamp: updatedDate.getTime(),
    slaHours: 24,
    slaDeadline: slaDeadlineStr,
    slaRemainingMinutes: 1440,
    isSlaBreached: Boolean(raw.isSlaBreached),
    imageUrl: raw.imageUrl || undefined,
    aiConfidence: raw.aiConfidence || 95,
    aiSuggestedCategory: raw.aiSuggestedCategory || raw.category || "General Municipal Services",
    aiReasoning: raw.aiReasoning || "AI verified and categorized.",
    priorityModelVersion: raw.priorityModelVersion || undefined,
    priorityPredictedAt: raw.priorityPredictedAt || undefined,
    timeline: timelineEvents,
    routingAuditTrail: raw.routingAuditTrail || [],
    resolutionEvidence: raw.resolutionEvidence || (raw.resolvedAt
      ? {
          imageUrl: raw.resolutionImageUrl || "",
          remarks: raw.resolutionRemarks || "Resolved",
          uploadedAt: new Date(raw.resolvedAt).toLocaleDateString("en-IN"),
          uploadedBy: raw.assignedOfficerName || "Field Team",
          inspectionPassed: true,
        }
      : undefined),
    feedback: raw.feedback?.[0] || (Array.isArray(raw.feedback) ? raw.feedback[0] : raw.feedback) || undefined,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
  };
}

/**
 * Loads incidents from localStorage in browser or cached memory on server
 */
export function getStoredIncidents(): MasterIncident[] {
  if (cachedIncidents && cachedIncidents.length > 0) {
    return cachedIncidents;
  }
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedIncidents = parsed;
          return cachedIncidents;
        }
      }
    } catch (e) {
      console.warn("Failed reading incidents from localStorage", e);
    }
  }
  return cachedIncidents;
}

/**
 * Strips huge Base64 data URIs before persisting to localStorage to respect browser 5MB storage limit
 */
function sanitizeForLocalStorage(incidents: MasterIncident[]): any[] {
  return incidents.map((inc) => {
    const clone = { ...inc };
    if (clone.imageUrl && clone.imageUrl.startsWith("data:") && clone.imageUrl.length > 500) {
      clone.imageUrl = undefined;
    }
    if (clone.supportingReports) {
      clone.supportingReports = clone.supportingReports.map((r) => ({
        ...r,
        imageUrl: (r.imageUrl && r.imageUrl.startsWith("data:") && r.imageUrl.length > 500) ? undefined : r.imageUrl,
      }));
    }
    return clone;
  });
}

/**
 * Saves incidents to storage and notifies subscribers
 */
export function saveIncidents(incidents: MasterIncident[]): void {
  cachedIncidents = [...incidents];
  if (typeof window !== "undefined") {
    try {
      const sanitized = sanitizeForLocalStorage(incidents);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      window.dispatchEvent(new CustomEvent("civicresolve:incident-updated", { detail: { timestamp: Date.now() } }));
    } catch (e) {
      console.warn("Failed saving incidents to localStorage", e);
    }
  }
}

/**
 * Synchronizes frontend incident store directly with PostgreSQL / Supabase backend.
 * Replaces any stale mock state with real database records.
 */
export async function fetchAndSyncDatabaseComplaints(token?: string): Promise<MasterIncident[]> {
  try {
    const effectiveToken = token || getSessionToken() || "";
    if (!effectiveToken) {
      return getStoredIncidents();
    }
    const complaints = await getAllComplaintsAdminApi(undefined, effectiveToken);
    if (complaints && complaints.length > 0) {
      const converted = complaints.map((c) => backendComplaintToIncident(c));
      saveIncidents(converted);
      return converted;
    }
    return getStoredIncidents();
  } catch {
    return getStoredIncidents();
  }
}

/**
 * Reset database to empty or sync from backend
 */
export function resetDatabaseToSeed(): MasterIncident[] {
  cachedIncidents = [];
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.dispatchEvent(new CustomEvent("civicresolve:incident-updated", { detail: { timestamp: Date.now() } }));
    } catch {}
  }
  return cachedIncidents;
}

/**
 * Dynamic Database Filter
 * Applies multi-tier filtering (Division, District, Authority, Department, Officer, Priority, Status, Date)
 */
export function queryIncidents(filters?: IncidentFilterParams, dataOverride?: MasterIncident[]): MasterIncident[] {
  const all = (dataOverride && dataOverride.length > 0) ? dataOverride : getStoredIncidents();
  if (!filters) return all;

  return all.filter((inc) => {
    // 1. Division
    if (filters.divisionId && filters.divisionId !== "ALL") {
      const matchDiv =
        inc.divisionId === filters.divisionId ||
        (inc.divisionName && inc.divisionName.toLowerCase() === filters.divisionId.toLowerCase()) ||
        (filters.divisionId.includes("kolhapur") && (inc.divisionId?.includes("kolhapur") || inc.divisionName?.toLowerCase().includes("kolhapur"))) ||
        (filters.divisionId.includes("pune") && (inc.divisionId?.includes("pune") || inc.divisionName?.toLowerCase().includes("pune")));
      if (!matchDiv) return false;
    }
    // 2. District
    if (filters.districtId && filters.districtId !== "ALL" && inc.districtId !== filters.districtId) {
      return false;
    }
    // 3. Local Authority
    if (filters.authorityId && filters.authorityId !== "ALL") {
      const matchAuth =
        inc.authorityId === filters.authorityId ||
        (inc.authorityName && inc.authorityName.toLowerCase() === filters.authorityId.toLowerCase()) ||
        (filters.authorityId.includes("kmc") && (inc.authorityId?.includes("kmc") || inc.authorityName?.toLowerCase().includes("kolhapur"))) ||
        (filters.authorityId.includes("pmc") && (inc.authorityId?.includes("pmc") || inc.authorityName?.toLowerCase().includes("pune")));
      if (!matchAuth) return false;
    }
    // 4. Department
    if (filters.departmentId && filters.departmentId !== "ALL") {
      const matchDept =
        inc.departmentId === filters.departmentId ||
        (inc.department && inc.department.toLowerCase() === filters.departmentId.toLowerCase()) ||
        (inc.departmentName && inc.departmentName.toLowerCase() === filters.departmentId.toLowerCase()) ||
        (filters.departmentId.includes("waste") && inc.department?.toLowerCase().includes("waste")) ||
        (filters.departmentId.includes("water") && inc.department?.toLowerCase().includes("water")) ||
        (filters.departmentId.includes("pwd") && (inc.department?.toLowerCase().includes("road") || inc.department?.toLowerCase().includes("pwd"))) ||
        (filters.departmentId.includes("drainage") && (inc.department?.toLowerCase().includes("drainage") || inc.department?.toLowerCase().includes("sanitation"))) ||
        (filters.departmentId.includes("electric") && (inc.department?.toLowerCase().includes("light") || inc.department?.toLowerCase().includes("electric")));
      if (!matchDept) return false;
    }
    // 5. Assigned Officer
    if (filters.officerId && filters.officerId !== "ALL" && inc.assignedOfficerId !== filters.officerId) {
      return false;
    }
    if (filters.assignedOfficerName && inc.assignedOfficer !== filters.assignedOfficerName) {
      return false;
    }
    // 6. Priority
    if (filters.priority && filters.priority !== "ALL" && inc.priority !== filters.priority) {
      return false;
    }
    // 7. Status
    if (filters.status && filters.status !== "ALL" && inc.status !== filters.status) {
      return false;
    }
    // 8. Search query (Incident ID, title, description, location, citizen phone, authority, department)
    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      const matchSearch =
        inc.incidentNumber.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.location.toLowerCase().includes(q) ||
        inc.authorityName.toLowerCase().includes(q) ||
        inc.department.toLowerCase().includes(q) ||
        inc.supportingReports.some((r) =>
          r.citizenName.toLowerCase().includes(q) ||
          r.citizenMobile.includes(q) ||
          r.trackingNumber.toLowerCase().includes(q)
        );
      if (!matchSearch) return false;
    }

    return true;
  });
}

/**
 * Calculates dynamic statistics over the queried incident records.
 * Returns all 9 required metrics from actual records.
 * NEVER hardcodes counts.
 */
export function computeDashboardStats(filters?: IncidentFilterParams, dataOverride?: MasterIncident[]): DashboardStats {
  const incidents = queryIncidents(filters, dataOverride);

  // Total citizen reports across all master incidents
  const totalComplaints = incidents.reduce((sum, inc) => sum + (inc.complaintCount || inc.supportingReports.length), 0);

  // Active Incidents: All master incidents that are not yet RESOLVED or REJECTED or CLOSED
  const activeIncidents = incidents.filter((inc) => inc.status !== "RESOLVED" && inc.status !== "REJECTED" && inc.status !== "CLOSED").length;

  // New Complaints: Incidents in SUBMITTED status and not assigned
  const newComplaints = incidents.filter((inc) => inc.status === "SUBMITTED" && !inc.assignedOfficerId).length;

  // Assigned Cases: Incidents with an assigned officer that are active
  const assignedCases = incidents.filter(
    (inc) => Boolean(inc.assignedOfficerId) && inc.status !== "RESOLVED" && inc.status !== "REJECTED" && inc.status !== "CLOSED"
  ).length;

  // Unassigned Cases: Active incidents without an assigned officer
  const unassignedCases = incidents.filter(
    (inc) => !inc.assignedOfficerId && inc.status !== "RESOLVED" && inc.status !== "REJECTED" && inc.status !== "CLOSED"
  ).length;

  // Pending Cases: Incidents awaiting work (SUBMITTED, VALIDATING, ASSIGNED)
  const pendingCases = incidents.filter(
    (inc) => inc.status === "SUBMITTED" || inc.status === "VALIDATING" || inc.status === "ASSIGNED"
  ).length;

  // In Progress Cases
  const inProgressCases = incidents.filter((inc) => inc.status === "IN_PROGRESS").length;

  // Resolved Cases
  const resolvedCases = incidents.filter((inc) => inc.status === "RESOLVED" || inc.status === "CLOSED").length;

  // Rejected Cases
  const rejectedCases = incidents.filter((inc) => inc.status === "REJECTED").length;

  // Escalated Cases
  const escalatedCases = incidents.filter((inc) => inc.status === "ESCALATED").length;

  // SLA Breached Cases
  const slaBreachedCases = incidents.filter((inc) => inc.isSlaBreached && inc.status !== "RESOLVED" && inc.status !== "CLOSED").length;

  // High Priority Cases
  const highPriorityCases = incidents.filter((inc) => inc.priority === "VERY_HIGH" || inc.priority === "HIGH").length;

  // Total Supporting Reports
  const totalSupportingReports = incidents.reduce((sum, inc) => sum + Math.max(0, inc.complaintCount - 1), 0);

  // Average Resolution Hours from resolved incidents
  let avgResolutionHours = 0;
  const resolvedList = incidents.filter((inc) => inc.status === "RESOLVED" || inc.status === "CLOSED");
  if (resolvedList.length > 0) {
    const totalHours = resolvedList.reduce((sum, inc) => {
      const start = inc.createdAtTimestamp || Date.now();
      const end = inc.lastReportedTimestamp || Date.now();
      const diffHours = Math.max(0.5, (end - start) / (1000 * 3600));
      return sum + diffHours;
    }, 0);
    avgResolutionHours = Math.round((totalHours / resolvedList.length) * 10) / 10;
  }

  // Resolution Rate %
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedCases / totalComplaints) * 100) : 0;

  return {
    totalComplaints,
    activeIncidents,
    newComplaints,
    assignedCases,
    unassignedCases,
    pendingCases,
    inProgressCases,
    resolvedCases,
    rejectedCases,
    escalatedCases,
    slaBreachedCases,
    highPriorityCases,
    totalSupportingReports,
    avgResolutionHours,
    resolutionRate,
  };
}

/**
 * Assigns an officer to a Master Incident.
 */
export function assignOfficerToIncident(
  incidentId: string,
  officerId: string,
  officerName: string,
  author = "Admin Command"
): MasterIncident | null {
  const all = getStoredIncidents();
  const target = all.find((i) => i.id === incidentId || i.incidentNumber === incidentId);

  if (!target) return null;

  target.assignedOfficerId = officerId;
  target.assignedOfficer = officerName;

  if (target.status === "SUBMITTED" || target.status === "VALIDATING") {
    target.status = "ASSIGNED";
  }

  target.timeline.push({
    status: "ASSIGNED",
    timestamp: "Just now",
    note: `Assigned to Officer ${officerName} (${officerId}).`,
    author,
  });

  saveIncidents(all);
  return target;
}

/**
 * Overrides the priority of an incident with SLA adjustment and timeline entry.
 */
export function overrideIncidentPriority(
  incidentId: string,
  newPriority: ComplaintPriority,
  reason: string,
  author = "Admin Command"
): MasterIncident | null {
  const all = getStoredIncidents();
  const target = all.find((i) => i.id === incidentId || i.incidentNumber === incidentId);

  if (!target) return null;

  const oldPriority = target.priority;
  target.priority = newPriority;

  // Recalculate SLA hours
  const slaMap: Record<string, number> = {
    VERY_HIGH: 4,
    CRITICAL: 4,
    HIGH: 12,
    MEDIUM: 24,
    LOW: 48,
  };
  target.slaHours = slaMap[newPriority] || 24;

  target.timeline.push({
    status: target.status,
    timestamp: "Just now",
    note: `Priority changed from ${oldPriority} to ${newPriority} by ${author}. Reason: ${reason || "Administrative review"}. SLA adjusted to ${target.slaHours}h.`,
    author,
  });

  saveIncidents(all);
  return target;
}

/**
 * Updates the status of an incident (e.g. Pending -> In Progress, In Progress -> Resolved, Escalated, Rejected).
 */
export function updateIncidentStatus(
  incidentId: string,
  newStatus: ComplaintStatus,
  evidence?: { imageUrl: string; remarks: string; uploadedBy: string },
  author = "Admin Command"
): MasterIncident | null {
  const all = getStoredIncidents();
  const target = all.find((i) => i.id === incidentId || i.incidentNumber === incidentId);

  if (!target) return null;

  const oldStatus = target.status;
  target.status = newStatus;

  if (evidence) {
    target.resolutionEvidence = {
      imageUrl: evidence.imageUrl,
      remarks: evidence.remarks,
      uploadedAt: "Just now",
      uploadedBy: evidence.uploadedBy,
      inspectionPassed: true,
    };
  }

  target.timeline.push({
    status: newStatus,
    timestamp: "Just now",
    note: `Status updated from ${oldStatus} to ${newStatus}.${evidence ? ` Remarks: "${evidence.remarks}"` : ""}`,
    author,
  });

  saveIncidents(all);
  return target;
}

/**
 * Ingests a new citizen complaint report.
 */
export function ingestCitizenComplaint(input: {
  citizenName: string;
  citizenMobile: string;
  category: string;
  description: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  imageUrl?: string;
  channel?: CitizenReport["channel"];
}): { incident: MasterIncident; isClustered: boolean; citizenReport: CitizenReport } {
  const all = getStoredIncidents();
  const coords = input.coordinates || { lat: 16.7120, lng: 74.2380 };
  const now = Date.now();

  const newReport: CitizenReport = {
    id: `cmp-rep-${Date.now().toString(36)}`,
    trackingNumber: `CMP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
    citizenName: input.citizenName || "Verified Citizen",
    citizenMobile: input.citizenMobile,
    description: input.description,
    location: input.location,
    coordinates: coords,
    imageUrl: input.imageUrl,
    reportedAt: "Just now",
    timestamp: now,
    channel: input.channel || "MOBILE_APP",
    aiConfidence: 96,
  };

  let matchedIncident: MasterIncident | null = null;
  let highestMatchScore = 0;

  for (const inc of all) {
    const evaluation = evaluateReportMatch(
      {
        category: input.category,
        description: input.description,
        location: input.location,
        coordinates: coords,
        timestamp: now,
      },
      inc
    );

    if (evaluation.isMatch && evaluation.matchScore > highestMatchScore) {
      highestMatchScore = evaluation.matchScore;
      matchedIncident = inc;
    }
  }

  if (matchedIncident) {
    matchedIncident.complaintCount += 1;
    matchedIncident.lastReportedAt = "Just now";
    matchedIncident.lastReportedTimestamp = now;
    matchedIncident.supportingReports.push(newReport);

    const newPriority = recalculateIncidentPriority(matchedIncident.complaintCount, matchedIncident.priority);
    if (newPriority !== matchedIncident.priority) {
      matchedIncident.priority = newPriority;
    }

    matchedIncident.timeline.push({
      status: matchedIncident.status,
      timestamp: "Just now",
      note: `New supporting complaint ${newReport.trackingNumber} linked from citizen ${newReport.citizenName}. Total reports: ${matchedIncident.complaintCount}.`,
      author: "Auto-Clustering Engine",
    });

    saveIncidents(all);
    return {
      incident: matchedIncident,
      isClustered: true,
      citizenReport: newReport,
    };
  }

  const newIncidentNumber = `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const newIncident: MasterIncident = {
    id: `inc-${Date.now().toString(36)}`,
    incidentNumber: newIncidentNumber,
    title: input.description.slice(0, 60) + (input.description.length > 60 ? "..." : ""),
    description: input.description,
    category: input.category,
    department: "Municipal Affairs & Public Works",
    departmentId: "dept-kmc-general",
    departmentName: "Municipal Public Works",
    authorityId: "auth-kmc",
    authorityName: "Kolhapur Municipal Corporation (KMC)",
    districtId: "dist-kolhapur",
    districtName: "Kolhapur District",
    divisionId: "div-kolhapur",
    divisionName: "Kolhapur Division",
    location: input.location,
    region: "Central Zone",
    coordinates: coords,
    status: "SUBMITTED",
    priority: "MEDIUM",
    complaintCount: 1,
    supportingReports: [newReport],
    firstReportedAt: "Just now",
    lastReportedAt: "Just now",
    createdAtTimestamp: now,
    lastReportedTimestamp: now,
    slaHours: 24,
    slaDeadline: "Tomorrow, same time",
    slaRemainingMinutes: 1440,
    isSlaBreached: false,
    imageUrl: input.imageUrl,
    aiConfidence: 95,
    aiSuggestedCategory: input.category,
    aiReasoning: "New unclustered civic issue detected. Dispatched to intake queue.",
    routingAuditTrail: [],
    timeline: [
      {
        status: "SUBMITTED",
        timestamp: "Just now",
        note: `Master Incident ${newIncidentNumber} created from citizen report (${input.citizenName || "Citizen"}).`,
        author: `Citizen (${input.citizenName || "Citizen"})`,
      },
    ],
  };

  all.unshift(newIncident);
  saveIncidents(all);

  return {
    incident: newIncident,
    isClustered: false,
    citizenReport: newReport,
  };
}

/**
 * Adapter converting MasterIncident to Complaint for compatibility with existing chart & map components
 */
export function incidentToComplaint(inc: MasterIncident): Complaint {
  return {
    id: inc.id,
    trackingNumber: inc.incidentNumber,
    title: inc.title,
    description: inc.description,
    category: inc.category,
    subcategory: inc.subcategory,
    department: inc.department,
    departmentId: inc.departmentId,
    departmentName: inc.departmentName,
    authorityId: inc.authorityId,
    authorityName: inc.authorityName,
    districtId: inc.districtId,
    districtName: inc.districtName,
    divisionId: inc.divisionId,
    divisionName: inc.divisionName,
    location: inc.location,
    region: inc.region,
    coordinates: inc.coordinates,
    status: inc.status,
    priority: inc.priority,
    assignedOfficer: inc.assignedOfficer,
    assignedOfficerId: inc.assignedOfficerId,
    citizenMobile: inc.supportingReports[0]?.citizenMobile || "+91 98220 00000",
    citizenName: inc.supportingReports[0]?.citizenName,
    date: new Date(inc.createdAtTimestamp).toISOString().split("T")[0],
    createdAt: inc.firstReportedAt,
    updatedAt: inc.lastReportedAt,
    imageUrl: inc.imageUrl,
    aiConfidence: inc.aiConfidence,
    aiSuggestedCategory: inc.aiSuggestedCategory,
    aiReasoning: inc.aiReasoning,
    timeline: inc.timeline,
    routingAuditTrail: inc.routingAuditTrail,
    resolutionEvidence: inc.resolutionEvidence,
    feedback: inc.feedback,
  };
}

/**
 * Returns citizen-specific complaints or all complaints adapted for Citizen Dashboard
 */
export function getCitizenComplaints(citizenMobile?: string): Complaint[] {
  const allIncidents = getStoredIncidents();
  const cleanMobile = citizenMobile ? citizenMobile.replace(/\D/g, "") : "";

  if (!cleanMobile) {
    return allIncidents.map(incidentToComplaint);
  }

  const userIncidents = allIncidents.filter((inc) => {
    return inc.supportingReports.some((rep) => {
      const repClean = rep.citizenMobile.replace(/\D/g, "");
      return repClean.length >= 10 && cleanMobile.length >= 10 && (repClean.includes(cleanMobile) || cleanMobile.includes(repClean));
    });
  });

  return userIncidents.map(incidentToComplaint);
}

/**
 * Finds a Master Incident or Citizen Report by Tracking Number
 */
export function getIncidentOrComplaintByTracking(trackingNumber: string): {
  incident: MasterIncident;
  report?: CitizenReport;
  complaint: Complaint;
} | null {
  if (!trackingNumber) return null;
  const q = trackingNumber.trim().toUpperCase();
  const all = getStoredIncidents();

  for (const inc of all) {
    if (inc.incidentNumber.toUpperCase() === q || inc.id.toUpperCase() === q) {
      return { incident: inc, complaint: incidentToComplaint(inc) };
    }
    const matchedRep = inc.supportingReports.find(
      (r) => r.trackingNumber.toUpperCase() === q || r.id.toUpperCase() === q
    );
    if (matchedRep) {
      return { incident: inc, report: matchedRep, complaint: incidentToComplaint(inc) };
    }
  }

  return null;
}

/**
 * Saves citizen feedback and rating for a complaint
 */
export function saveCitizenFeedback(
  trackingNumber: string,
  feedback: CitizenFeedback
): boolean {
  if (!trackingNumber) return false;
  const q = trackingNumber.trim().toUpperCase();
  const all = getStoredIncidents();

  const target = all.find(
    (inc) =>
      inc.incidentNumber.toUpperCase() === q ||
      inc.id.toUpperCase() === q ||
      inc.supportingReports.some((r) => r.trackingNumber.toUpperCase() === q)
  );

  if (!target) return false;

  target.feedback = feedback;

  target.timeline.push({
    status: target.status,
    timestamp: "Just now",
    note: `Citizen Feedback Submitted: ${feedback.rating}/5 Stars (${feedback.satisfactionLevel}). Remarks: "${feedback.comments}"`,
    author: "Citizen",
  });

  if (feedback.reopenRequested) {
    target.status = "REOPENED";
    target.timeline.push({
      status: "REOPENED",
      timestamp: "Just now",
      note: "Grievance reopened by citizen due to unsatisfactory field remediation.",
      author: "Citizen (Reopening Request)",
    });
  }

  saveIncidents(all);
  emitRealTimeEvent("FEEDBACK_SUBMITTED", {
    incidentId: target.id,
    trackingNumber: target.incidentNumber,
    rating: feedback.rating,
  });

  return true;
}

/**
 * Returns map-formatted incident items for Mappls map markers.
 */
export function getMapIncidents(filters?: IncidentFilterParams, dataOverride?: MasterIncident[]): MapIncidentItem[] {
  const incidents = queryIncidents(filters, dataOverride);
  return incidents.map((inc) => ({
    incidentId: inc.id,
    latitude: inc.coordinates.lat,
    longitude: inc.coordinates.lng,
    complaintCount: inc.complaintCount,
    category: inc.category,
    subcategory: inc.subcategory,
    priority: inc.priority,
    department: inc.department,
    departmentId: inc.departmentId,
    status: inc.status,
    division: inc.divisionName,
    divisionId: inc.divisionId,
    district: inc.districtName,
    districtId: inc.districtId,
    authority: inc.authorityName,
    authorityId: inc.authorityId,
    slaDeadline: inc.slaDeadline,
    slaRemainingMinutes: inc.slaRemainingMinutes,
    isSlaBreached: inc.isSlaBreached,
    title: inc.title,
    description: inc.description,
    location: inc.location,
    lastReportedAt: inc.lastReportedAt,
    assignedOfficer: inc.assignedOfficer,
    assignedOfficerId: inc.assignedOfficerId,
    imageUrl: inc.imageUrl,
  }));
}

/**
 * Groups nearby master incidents into geographic clusters for map overview.
 */
export function getMapClusters(filters?: IncidentFilterParams, dataOverride?: MasterIncident[]): MapClusterItem[] {
  const incidents = queryIncidents(filters, dataOverride).filter((i) => i.coordinates.lat !== 0 && i.coordinates.lng !== 0);
  const clusters: MapClusterItem[] = [];
  const visited = new Set<string>();

  for (const inc of incidents) {
    if (visited.has(inc.id)) continue;

    const clusterIncidents = [inc];
    visited.add(inc.id);

    for (const other of incidents) {
      if (visited.has(other.id)) continue;
      const dist = calculateHaversineDistance(
        inc.coordinates.lat,
        inc.coordinates.lng,
        other.coordinates.lat,
        other.coordinates.lng
      );
      if (dist <= 1500) {
        clusterIncidents.push(other);
        visited.add(other.id);
      }
    }

    const totalComplaints = clusterIncidents.reduce((sum, item) => sum + item.complaintCount, 0);
    const avgLat = clusterIncidents.reduce((sum, item) => sum + item.coordinates.lat, 0) / clusterIncidents.length;
    const avgLng = clusterIncidents.reduce((sum, item) => sum + item.coordinates.lng, 0) / clusterIncidents.length;

    let maxLat = -90, minLat = 90, maxLng = -180, minLng = 180;
    for (const item of clusterIncidents) {
      if (item.coordinates.lat > maxLat) maxLat = item.coordinates.lat;
      if (item.coordinates.lat < minLat) minLat = item.coordinates.lat;
      if (item.coordinates.lng > maxLng) maxLng = item.coordinates.lng;
      if (item.coordinates.lng < minLng) minLng = item.coordinates.lng;
    }

    const hasVeryHigh = clusterIncidents.some((i) => i.priority === "VERY_HIGH");
    const hasHigh = clusterIncidents.some((i) => i.priority === "HIGH");
    const hasMedium = clusterIncidents.some((i) => i.priority === "MEDIUM");
    const dominantPriority: ComplaintPriority = hasVeryHigh ? "VERY_HIGH" : hasHigh ? "HIGH" : hasMedium ? "MEDIUM" : "LOW";

    clusters.push({
      clusterId: `cluster-${inc.region.toLowerCase().replace(/\s+/g, "-")}-${clusters.length + 1}`,
      title: `${inc.region} Cluster (${clusterIncidents.length} Incidents, ${totalComplaints} Reports)`,
      center: { lat: avgLat, lng: avgLng },
      incidentCount: clusterIncidents.length,
      totalComplaints,
      dominantCategory: inc.category,
      dominantPriority,
      incidents: clusterIncidents.map((i) => i.id),
      bounds: {
        north: maxLat + 0.002,
        south: minLat - 0.002,
        east: maxLng + 0.002,
        west: minLng - 0.002,
      },
    });
  }

  return clusters;
}

/**
 * Computes geographic density hotspots from real database incidents.
 * PriorityScore formula: (Density * 2) + (HighPriority * 3) + (Unresolved * 2) + (Overdue * 4)
 * High Risk: >= 15, Medium Risk: >= 8, Normal: < 8
 */
export function getMapHotspots(filters?: IncidentFilterParams, dataOverride?: MasterIncident[]): MapHotspotItem[] {
  const incidents = queryIncidents(filters, dataOverride).filter((i) => i.coordinates.lat !== 0 && i.coordinates.lng !== 0);
  const hotspots: MapHotspotItem[] = [];

  for (const inc of incidents) {
    const isHighPri = inc.priority === "HIGH" || inc.priority === "VERY_HIGH" ? 1 : 0;
    const isUnresolved = inc.status !== "RESOLVED" && inc.status !== "CLOSED" ? 1 : 0;
    const isOverdue = inc.isSlaBreached ? 1 : 0;
    const density = inc.complaintCount;

    // Documented priority score formula
    const priorityScore = (density * 2) + (isHighPri * 3) + (isUnresolved * 2) + (isOverdue * 4);

    if (priorityScore >= 8 || density >= 3) {
      let densityLevel: "CRITICAL" | "HIGH" | "MODERATE" = "MODERATE";
      let color = "rgba(15, 118, 110, 0.22)";
      let borderColor = "#0F766E";
      let radiusMeters = 200;

      if (priorityScore >= 15) {
        densityLevel = "CRITICAL";
        color = "rgba(220, 38, 38, 0.24)";
        borderColor = "#DC2626";
        radiusMeters = 400;
      } else if (priorityScore >= 8) {
        densityLevel = "HIGH";
        color = "rgba(245, 158, 11, 0.24)";
        borderColor = "#F59E0B";
        radiusMeters = 300;
      }

      hotspots.push({
        id: `hotspot-${inc.id}`,
        name: `${inc.location.split(",")[0] || inc.location} ${inc.category} Density Zone`,
        center: { lat: inc.coordinates.lat, lng: inc.coordinates.lng },
        radiusMeters,
        complaintCount: inc.complaintCount,
        incidentCount: 1,
        densityLevel,
        dominantCategory: inc.category,
        divisionId: inc.divisionId,
        authorityId: inc.authorityId,
        color,
        borderColor,
      });
    }
  }

  return hotspots;
}
