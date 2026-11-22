"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  FileText,
  Map,
  BarChart3,
  FileSpreadsheet,
  Users,
  Settings,
  Sliders,
  Bell,
  Building2,
  Search,
  ArrowUpDown,
  LogOut,
  Sparkles,
  ChevronRight,
  Menu,
  X,
  Clock,
  AlertTriangle,
  RotateCcw,
  FolderTree,
  MapPin,
  CheckCircle2,
  Briefcase,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { ComplaintsMapView } from "@/components/map/complaints-map-view";
import dynamic from "next/dynamic";
import { AssignedWorkModal } from "@/components/admin/assigned-work-modal";
import { IncidentDetailsModal } from "@/components/admin/incident-details-modal";

const DepartmentAdminView = dynamic(
  () => import("@/components/admin/department-admin-view").then((m) => m.DepartmentAdminView),
  { ssr: false }
);

const OfficerWorkspaceView = dynamic(
  () => import("@/components/officer/officer-workspace-view").then((m) => m.OfficerWorkspaceView),
  { ssr: false }
);

const SuperAdminView = dynamic(
  () => import("@/components/admin/super-admin-view").then((m) => m.SuperAdminView),
  {
    loading: () => (
      <div className="p-8 text-center bg-white rounded-xl border border-[#CBD5E1] text-xs text-[#64748B] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#0B4EA2] border-t-transparent rounded-full animate-spin" />
        <span>Loading Super Admin Console...</span>
      </div>
    ),
  }
);

const ComplaintsAnalyticsView = dynamic(
  () => import("@/components/analytics/complaints-analytics-view").then((m) => m.ComplaintsAnalyticsView),
  {
    loading: () => (
      <div className="p-8 text-center bg-white rounded-xl border border-[#CBD5E1] text-xs text-[#64748B] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#0B4EA2] border-t-transparent rounded-full animate-spin" />
        <span>Loading Analytics...</span>
      </div>
    ),
  }
);

const ComplaintsReportsView = dynamic(
  () => import("@/components/reports/complaints-reports-view").then((m) => m.ComplaintsReportsView),
  {
    loading: () => (
      <div className="p-8 text-center bg-white rounded-xl border border-[#CBD5E1] text-xs text-[#64748B] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#0B4EA2] border-t-transparent rounded-full animate-spin" />
        <span>Loading Reports...</span>
      </div>
    ),
  }
);

const OfficersManagementView = dynamic(
  () => import("@/components/officers/officers-management-view").then((m) => m.OfficersManagementView),
  {
    loading: () => (
      <div className="p-8 text-center bg-white rounded-xl border border-[#CBD5E1] text-xs text-[#64748B] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#0B4EA2] border-t-transparent rounded-full animate-spin" />
        <span>Loading Field Officers Directory...</span>
      </div>
    ),
  }
);

const HierarchyManagementView = dynamic(
  () => import("@/components/admin/hierarchy-management-view").then((m) => m.HierarchyManagementView),
  {
    loading: () => (
      <div className="p-8 text-center bg-white rounded-xl border border-[#CBD5E1] text-xs text-[#64748B] flex items-center justify-center gap-2">
        <div className="w-5 h-5 border-2 border-[#0B4EA2] border-t-transparent rounded-full animate-spin" />
        <span>Loading Hierarchy...</span>
      </div>
    ),
  }
);

import {
  getStoredIncidents,
  queryIncidents,
  computeDashboardStats,
  assignOfficerToIncident,
  overrideIncidentPriority,
  updateIncidentStatus,
  incidentToComplaint,
  fetchAndSyncDatabaseComplaints,
} from "@/lib/db/incidents-db";
import { subscribeToRealTime, emitRealTimeEvent } from "@/lib/realtime/events";
import { getSocket, onNotificationReceived } from "@/lib/realtime/socket-client";
import { MOCK_OFFICERS } from "@/lib/api/officers";
import {
  INITIAL_DIVISIONS,
  INITIAL_AUTHORITIES,
  INITIAL_DEPARTMENTS,
} from "@/lib/api/hierarchy";
import { getSessionUser, getSessionToken, clearSession } from "@/lib/auth/session";
import { fetchOfficersApi, fetchDepartmentsApi, OfficerItem, DepartmentItem } from "@/lib/api/admin";
import { reassignComplaintDepartmentApi } from "@/lib/api/complaints";
import { updateComplaintStatusApi, assignComplaintOfficerApi,
  overrideComplaintPriorityApi, getAdminStatsApi } from "@/lib/api/complaints";
import { ComplaintPriority, ComplaintStatus } from "@/types/complaint";
import { MasterIncident, DashboardStats } from "@/types/incident";
import { Officer } from "@/types/officer";
import { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import Link from "next/link";
import ROUTES from "@/config/routes";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLanguage } from "@/context/language-context";
import { CivicResolveLogo } from "@/components/common/civic-logo";
import { ThemeToggle } from "@/components/common/theme-toggle";

type AdminTab =
  | "dashboard"
  | "superadmin"
  | "complaints"
  | "map"
  | "analytics"
  | "reports"
  | "officers"
  | "dept_ops"
  | "officer"
  | "hierarchy"
  | "management"
  | "settings";

function officerItemToOfficer(item: OfficerItem): Officer {
  return {
    id: item.id,
    badgeId: item.badgeId || `OFF-${item.id.slice(0, 4)}`,
    name: item.name,
    designation: item.designation || "Field Officer",
    department: item.department?.name || "General Municipal Services",
    departmentId: item.departmentId || "dept-kmc-general",
    authorityId: "auth-kmc",
    authorityName: "Kolhapur Municipal Corporation (KMC)",
    districtId: "dist-kolhapur",
    divisionId: "div-kolhapur",
    divisionName: "Kolhapur Division",
    mobileNumber: item.phoneNumber,
    email: item.email || "",
    status: item.isAvailable ? "AVAILABLE" : "BUSY",
    assignedComplaintsCount: item.activeCases,
    resolvedComplaintsCount: item.resolvedCases,
    performanceScore: Math.round((item.rating || 4.5) * 20),
    averageResolutionHours: item.avgResolutionHours || 6.5,
    assignedZone: item.district || "Central Zone",
  };
}

// Static default admin profile representing verified backend credentials
const DEFAULT_ADMIN: AuthUser = {
  id: "adm_401",
  mobileNumber: "+919822012345",
  role: "ADMIN",
  name: "Rajesh Sharma",
  designation: "Chief Grievance Redressal Administrator",
  department: "Municipal Affairs & Intelligence Directorate",
  badgeId: "ADM-HQ-401",
  isVerified: true,
};

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // Navigation state
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Admin session state
  const [adminUser, setAdminUser] = useState<AuthUser>(DEFAULT_ADMIN);
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Data state: Master Incidents
  const [incidents, setIncidents] = useState<MasterIncident[]>([]);
  const [officers, setOfficers] = useState<Officer[]>(MOCK_OFFICERS);
  const [dbDepartments, setDbDepartments] = useState<DepartmentItem[]>([]);
  const [serverStats, setServerStats] = useState<{
    total: number;
    newComplaints: number;
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
    highPriority: number;
    slaBreached: number;
    avgResolutionHours: number;
    complianceRate: number;
    resolutionRate: number;
  } | null>(null);

  // Selected item modal & Assigned Work modal
  const [selectedIncident, setSelectedIncident] = useState<MasterIncident | null>(null);
  const [isAssignedWorkModalOpen, setIsAssignedWorkModalOpen] = useState(false);


  useEffect(() => {
    const sessionToken = getSessionToken();
    const session = getSessionUser();
    const normalizedSessionRole = session?.role === "ADMIN" ? "DEPARTMENT_ADMIN" : session?.role;
    if (!sessionToken || !session || (normalizedSessionRole !== "DEPARTMENT_ADMIN" && normalizedSessionRole !== "SUPER_ADMIN" && normalizedSessionRole !== "OFFICER")) {
      router.replace(`${ROUTES.AUTH.LOGIN}?redirect=/admin/dashboard`);
      return;
    }

    setToken(sessionToken);
    setAdminUser({ ...session, role: normalizedSessionRole as any });
    if ((normalizedSessionRole === "DEPARTMENT_ADMIN" || normalizedSessionRole === "OFFICER") && session.departmentId) {
      setSelectedDepartmentId(session.departmentId);
    }

    // Pre-populate incidents immediately from persistent local repository (0ms)
    try {
      const initialData = getStoredIncidents();
      if (initialData && initialData.length > 0) {
        setIncidents(initialData);
      }
    } catch {}

    setAuthChecked(true);

    fetchOfficersApi(
      normalizedSessionRole !== "SUPER_ADMIN" && session.departmentId
        ? { departmentId: session.departmentId }
        : undefined
    ).then((list) => {
      if (list && list.length > 0) {
        setOfficers(list.map(officerItemToOfficer));
      }
    }).catch(() => {});
    fetchDepartmentsApi().then((deps) => {
      if (deps && deps.length > 0) {
        setDbDepartments(deps);
      }
    }).catch(() => {});

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as AdminTab | null;
      if (
        tabParam &&
        [
          "dashboard",
          "superadmin",
          "complaints",
          "map",
          "analytics",
          "reports",
          "officers",
          "dept_ops",
          "officer",
          "hierarchy",
          "management",
          "settings",
        ].includes(tabParam)
      ) {
        if (normalizedSessionRole === "OFFICER" && !["officer", "complaints", "map", "settings"].includes(tabParam)) {
          setActiveTab("officer");
        } else if (
          normalizedSessionRole === "DEPARTMENT_ADMIN" &&
          ["superadmin", "hierarchy", "management", "officer"].includes(tabParam)
        ) {
          setActiveTab("dashboard");
        } else {
          setActiveTab(tabParam);
        }
      } else if (normalizedSessionRole === "SUPER_ADMIN") {
        setActiveTab("superadmin");
      } else if (normalizedSessionRole === "OFFICER") {
        setActiveTab("officer");
      } else if (normalizedSessionRole === "DEPARTMENT_ADMIN") {
        setActiveTab("dashboard");
      }
    }
  }, [router]);


  // Initial database load & live real-time subscription
  useEffect(() => {
    let isSubscribed = true;

    // Fetch fresh complaints and live stats directly from backend database in parallel
    const tokenVal = getSessionToken();
    if (tokenVal) {
      fetchAndSyncDatabaseComplaints(tokenVal).then((fresh) => {
        if (isSubscribed && fresh && fresh.length > 0) {
          setIncidents([...fresh]);
        }
      });
      getAdminStatsApi(tokenVal).then((s) => s && isSubscribed && setServerStats(s)).catch(() => {});
    }

    // 2. Real-time subscription: updates dashboard immediately on any database mutation
    const unsubscribe = subscribeToRealTime(async () => {
      if (!isSubscribed) return;
      const tokenVal = getSessionToken();
      const freshData = await fetchAndSyncDatabaseComplaints(tokenVal || undefined);
      setIncidents([...freshData]);
      if (tokenVal) {
        getAdminStatsApi(tokenVal).then((s) => s && setServerStats(s)).catch(() => {});
      }
    });

    // 2b. Direct Socket.IO Real-Time Listener
    getSocket();
    const unsubSocket = onNotificationReceived(async () => {
      if (!isSubscribed) return;
      const tokenVal = getSessionToken();
      const freshData = await fetchAndSyncDatabaseComplaints(tokenVal || undefined);
      setIncidents([...freshData]);
      if (tokenVal) {
        getAdminStatsApi(tokenVal).then((s) => s && setServerStats(s)).catch(() => {});
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
      unsubSocket();
    };
  }, []);

  // Multi-tier Cascading Hierarchical Filter State
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("ALL");
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>("ALL");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("ALL");
  const [selectedOfficerId] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "count">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Cascading authorities & departments for admin filter selection
  const availableAuthorities = useMemo(() => {
    if (selectedDivisionId === "ALL") return INITIAL_AUTHORITIES;
    return INITIAL_AUTHORITIES.filter((a) => a.divisionId === selectedDivisionId);
  }, [selectedDivisionId]);

  const availableDepartments = useMemo(() => {
    if (dbDepartments && dbDepartments.length > 0) {
      return dbDepartments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code || "DEPT",
        authorityId: "auth-kmc",
        authorityName: "Kolhapur Municipal Corporation (KMC)",
        districtId: "dist-kolhapur",
        divisionId: "div-kolhapur",
        headOfficerName: d.headOfficerName || "Department Head",
        categories: [],
        activeOfficersCount: d._count?.officers || 5,
      }));
    }
    if (selectedAuthorityId === "ALL") return INITIAL_DEPARTMENTS;
    return INITIAL_DEPARTMENTS.filter((d) => d.authorityId === selectedAuthorityId);
  }, [selectedAuthorityId, dbDepartments]);

  const handleDivisionChange = (divId: string) => {
    setSelectedDivisionId(divId);
    setSelectedAuthorityId("ALL");
    setSelectedDepartmentId(adminUser.role !== "SUPER_ADMIN" && adminUser.departmentId ? adminUser.departmentId : "ALL");
  };

  const handleAuthorityChange = (authId: string) => {
    setSelectedAuthorityId(authId);
    setSelectedDepartmentId(adminUser.role !== "SUPER_ADMIN" && adminUser.departmentId ? adminUser.departmentId : "ALL");
  };

  // Filtered Master Incidents based on Admin selections
  const displayIncidents = useMemo(() => {
    return queryIncidents(
      {
        divisionId: selectedDivisionId,
        authorityId: selectedAuthorityId,
        departmentId: selectedDepartmentId,
        officerId: selectedOfficerId,
        priority: filterPriority,
        status: filterStatus,
        search: searchQuery,
      },
      incidents
    ).sort((a, b) => {
      if (sortBy === "count") {
        return sortOrder === "desc" ? b.complaintCount - a.complaintCount : a.complaintCount - b.complaintCount;
      }
      if (sortBy === "priority") {
        const pOrder: Record<ComplaintPriority, number> = {
          CRITICAL: 4,
          VERY_HIGH: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };
        const diff = pOrder[b.priority] - pOrder[a.priority];
        return sortOrder === "desc" ? diff : -diff;
      }
      return sortOrder === "desc"
        ? b.lastReportedTimestamp - a.lastReportedTimestamp
        : a.lastReportedTimestamp - b.lastReportedTimestamp;
    });
  }, [
    incidents,
    searchQuery,
    selectedDivisionId,
    selectedAuthorityId,
    selectedDepartmentId,
    selectedOfficerId,
    filterPriority,
    filterStatus,
    sortBy,
    sortOrder,
  ]);

  // Adapted complaints for Map & Analytics components
  const adaptedComplaints = useMemo(() => {
    return incidents.map(incidentToComplaint);
  }, [incidents]);

  // Critical incidents for Admin notification alerts
  const criticalIncidents = useMemo(() => {
    return incidents.filter(
      (i) => i.priority === "VERY_HIGH" || i.status === "ESCALATED" || i.isSlaBreached
    );
  }, [incidents]);

  // DYNAMIC DASHBOARD STATS: Computed completely from real database state
  const stats: DashboardStats = useMemo(() => {
    if (incidents.length < 0) return computeDashboardStats();
    return computeDashboardStats({
      divisionId: selectedDivisionId,
      authorityId: selectedAuthorityId,
      departmentId: selectedDepartmentId,
      officerId: selectedOfficerId,
      priority: filterPriority,
      status: filterStatus,
      search: searchQuery,
    }, incidents);
  }, [
    incidents,
    selectedDivisionId,
    selectedAuthorityId,
    selectedDepartmentId,
    selectedOfficerId,
    filterPriority,
    filterStatus,
    searchQuery,
  ]);

  const handleLogout = () => {
    clearSession();
    router.push(ROUTES.HOME);
  };
  const handleSignOut = handleLogout;

  const handleReassignDepartment = async (
    incidentId: string,
    departmentId: string,
    reason: string
  ) => {
    try {
      if (token) {
        await reassignComplaintDepartmentApi(incidentId, departmentId, reason, token);
        const fresh = await fetchAndSyncDatabaseComplaints(token);
        setIncidents([...fresh]);
        if (selectedIncident?.id === incidentId) {
          const updated = fresh.find((i) => i.id === incidentId) || null;
          setSelectedIncident(updated);
        }
      }
    } catch (err: any) {
      alert(err?.message || "Failed to reassign complaint department.");
    }
  };

  const handleReassignOfficer = async (
    incidentId: string,
    officerId: string,
    officerName: string
  ) => {
    try {
      if (token) {
        await assignComplaintOfficerApi(incidentId, officerId, officerName, token);
      }
    } catch (e) {
      console.warn("Backend assign officer notice:", e);
    }

    assignOfficerToIncident(incidentId, officerId, officerName, adminUser.name || "Administrator");
    emitRealTimeEvent("OFFICER_ASSIGNED", { incidentId, officerId, officerName });
    const fresh = getStoredIncidents();
    setIncidents([...fresh]);
    if (selectedIncident && selectedIncident.id === incidentId) {
      const updated = fresh.find((i) => i.id === incidentId);
      if (updated) setSelectedIncident(updated);
    }
  };

  const handleOverridePriority = async (
    incidentId: string,
    newPriority: ComplaintPriority,
    reason: string
  ) => {
    try {
      if (token) {
        await overrideComplaintPriorityApi(incidentId, newPriority, reason, token);
      }
    } catch (e) {
      console.warn("Backend override priority notice:", e);
    }

    overrideIncidentPriority(incidentId, newPriority, reason, adminUser.name || "Administrator");
    emitRealTimeEvent("PRIORITY_OVERRIDDEN", { incidentId, newPriority, reason });
    const fresh = getStoredIncidents();
    setIncidents([...fresh]);
    if (selectedIncident && selectedIncident.id === incidentId) {
      const updated = fresh.find((i) => i.id === incidentId);
      if (updated) setSelectedIncident(updated);
    }
  };

  const handleUpdateStatus = async (
    incidentId: string,
    newStatus: ComplaintStatus,
    evidenceRemarks?: string
  ) => {
    try {
      if (token) {
        await updateComplaintStatusApi(
          incidentId,
          newStatus,
          {
            resolutionRemarks: evidenceRemarks,
            rejectionReason: evidenceRemarks,
          },
          token
        );
      }
    } catch (e) {
      console.warn("Backend update status notice:", e);
    }

    updateIncidentStatus(
      incidentId,
      newStatus,
      evidenceRemarks
        ? {
            imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80",
            remarks: evidenceRemarks,
            uploadedBy: adminUser.name || "Administrator",
          }
        : undefined,
      adminUser.name || "Administrator"
    );
    emitRealTimeEvent(newStatus === "RESOLVED" ? "CASE_RESOLVED" : "STATUS_CHANGED", {
      incidentId,
      status: newStatus,
    });
    const fresh = getStoredIncidents();
    setIncidents([...fresh]);
    if (selectedIncident && selectedIncident.id === incidentId) {
      const updated = fresh.find((i) => i.id === incidentId);
      if (updated) setSelectedIncident(updated);
    }
  };

  const isSuperAdmin = adminUser.role === "SUPER_ADMIN";
  const isDepartmentAdmin = adminUser.role === "DEPARTMENT_ADMIN" || adminUser.role === "ADMIN";
  const isOfficer = adminUser.role === "OFFICER";

  const sidebarLinks: { id: AdminTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "dashboard", label: t("adminDashboard", "Admin Dashboard"), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "dept_ops", label: t("deptOperations", "Officers & Field Workers"), icon: <Building2 className="w-4 h-4" /> },
    { id: "officer", label: t("officerWorkspace", "Officer Workspace"), icon: <Users className="w-4 h-4" /> },
    ...(isSuperAdmin
      ? [
          {
            id: "superadmin" as AdminTab,
            label: t("superAdminConsole", "Super Admin Console"),
            icon: <Shield className="w-4 h-4 text-[#B45309]" />,
            
          },
        ]
      : []),
    {
      id: "complaints",
      label: t("manageComplaints", "Manage Complaints"),
      icon: <FileText className="w-4 h-4" />,
      badge: `${incidents.length}`,
    },
    { id: "map", label: t("mapHotspots", "Map & Hotspots"), icon: <Map className="w-4 h-4" /> },
    { id: "analytics", label: t("reportsAnalytics", "Reports & Analytics"), icon: <BarChart3 className="w-4 h-4" /> },
    { id: "reports", label: t("auditReports", "Audit Reports"), icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: "officers", label: t("manageOfficers", "Manage Officers"), icon: <Users className="w-4 h-4" />, badge: `${officers.length}` },
    { id: "hierarchy", label: t("hierarchyTopology", "Hierarchy Topology"), icon: <FolderTree className="w-4 h-4" /> },
    { id: "settings", label: t("settings", "Settings"), icon: <Settings className="w-4 h-4" /> },
  ];

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex items-center justify-center transition-colors">
        <div className="text-center p-8 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#1E293B] rounded-2xl shadow-xs">
          <div className="w-10 h-10 border-3 border-[#083B7A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC]">Verifying Admin Credentials...</h2>
          <p className="text-xs text-[#64748B] mt-1">Authorized Department Personnel Only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col selection:bg-[#EAF2FF] selection:text-[#0B4EA2] transition-colors">
      {/* TOP HEADER WITH BRANDING & STATIC ADMIN PROFILE */}
      <header className="w-full bg-white dark:bg-[#0D131F] border-b border-[#E2E8F0] dark:border-[#1E293B] h-16 px-4 sm:px-6 sticky top-0 z-40 flex items-center justify-between shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <CivicResolveLogo
            subtitle={t("directorateSubtitle", "Directorate of Municipal Services • Officer Console")}
            href={ROUTES.ADMIN.DASHBOARD}
          />
        </div>

        {/* Right header actions: Static Admin Identity, Alerts, Sign out, Language */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 justify-end">
          <ThemeToggle />
          <LanguageSwitcher />

          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("superadmin")}
              className={`text-xs h-9 border-[#B45309] dark:border-[#D97706]/50 text-[#B45309] dark:text-[#FBBF24] hover:bg-[#FFF7E6] dark:hover:bg-[#78350F]/20 font-semibold ${
                activeTab === "superadmin" ? "bg-[#FFF7E6]" : ""
              }`}
              leftIcon={<Shield className="w-3.5 h-3.5 text-[#B45309]" />}
            >
              <span className="hidden md:inline">{t("superAdminConsole", "Super Admin Console")}</span><span className="inline md:hidden">Super Admin</span>
            </Button>
          )}

          {/* Static Admin Profile (Loaded from backend login session) */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#111827]">
            <div className={`w-8 h-8 rounded-full ${isSuperAdmin ? "bg-[#B45309]" : "bg-[#0B4EA2]"} text-white flex items-center justify-center font-bold text-xs shadow-xs`}>
              {adminUser.name
                ? adminUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : isSuperAdmin
                ? "SM"
                : "AD"}
            </div>
            <div className="text-left hidden sm:block">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC] leading-tight">
                  {adminUser.name || (isSuperAdmin ? "Sushant More" : "Rajesh Sharma")}
                </span>
                {adminUser.departmentName && !isSuperAdmin && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#EAF2FF] dark:bg-[#1E3A8A]/40 text-[#0B4EA2] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1D4ED8]/50">
                    {adminUser.departmentName}
                  </span>
                )}
                {isSuperAdmin ? (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FFF7E6] dark:bg-[#78350F]/30 text-[#B45309] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#B45309]/50 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-[#B45309]" />
                    SUPER ADMIN
                  </span>
                ) : (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]/50">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium block">
                {adminUser.badgeId || (isSuperAdmin ? "MH-SADM-01" : "ADM-HQ-401")} • {adminUser.designation || (isSuperAdmin ? "Super Administrator" : "Administrator")}
              </span>
            </div>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] shadow-2xs transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {criticalIncidents.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#DC2626] rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-2 mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                    <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                    <span>Statewide Critical Incidents ({criticalIncidents.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs text-[#64748B] hover:text-[#0F172A]"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {criticalIncidents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#64748B]">
                      No critical incidents requiring immediate intervention.
                    </div>
                  ) : (
                    criticalIncidents.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedIncident(c);
                          setNotificationsOpen(false);
                        }}
                        className="p-2.5 rounded-lg border border-[#FECACA] dark:border-[#DC2626]/40 bg-[#FEF2F2]/40 dark:bg-[#7F1D1D]/20 hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/30 cursor-pointer transition-colors text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#DC2626]">
                            {c.incidentNumber}
                          </span>
                          <PriorityBadge priority={c.priority} size="sm" />
                        </div>
                        <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">{c.title}</p>
                        <span className="text-[11px] text-[#64748B] block truncate">
                          {c.authorityName} • {c.location} • {c.complaintCount} reports
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-xs h-9 inline-flex"
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            {t("logout", "Logout")}
          </Button>
        </div>
      </header>

      {/* MAIN LAYOUT: SIDEBAR + CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-[#0D131F] border-r border-[#E2E8F0] dark:border-[#1E293B] pt-16 md:pt-0 transform md:relative md:translate-x-0 transition-all duration-200 ease-in-out flex flex-col justify-between",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="py-5 px-3 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
              {t("centralAdministration", "Central Administration")}
            </div>
            {sidebarLinks
              .filter((link) => {
                if (isOfficer) {
                  return ["officer", "complaints", "map", "settings"].includes(link.id);
                }
                if (isDepartmentAdmin) {
                  return ["dashboard", "dept_ops", "complaints", "map", "analytics", "reports", "officers", "settings"].includes(link.id);
                }
                return !["dept_ops", "officer"].includes(link.id);
              })
              .map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  setActiveTab(link.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === link.id
                    ? "bg-[#0B4EA2] dark:bg-[#1D4ED8] text-white font-semibold shadow-xs"
                    : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
                )}
              >
                <div className="flex items-center gap-3">
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      activeTab === link.id
                        ? "bg-white/20 text-white"
                        : "bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]"
                    )}
                  >
                    {link.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0B0F17] text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
              <span>{t("municipalServices", "Municipal Services")}</span>
              <span className="text-[#16A34A] font-semibold text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                {t("operational", "Operational")}
              </span>
            </div>
          </div>
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* ==================== TAB: SUPER ADMIN CONSOLE ==================== */}
          {activeTab === "superadmin" && (
            <SuperAdminView
              currentUser={adminUser}
              incidents={incidents}
              onFilterDistrict={(divId) => {
                setSelectedDivisionId(divId);
                setActiveTab("complaints");
              }}
            />
          )}

          {/* ==================== TAB 1: DASHBOARD OVERVIEW ==================== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                    {t("adminDashboard", "Admin Dashboard")}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                    Centralized platform monitoring complaints and officer dispatch across jurisdictions.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAssignedWorkModalOpen(true)}
                    className="text-xs border-[#CBD5E1]"
                    leftIcon={<Briefcase className="w-3.5 h-3.5 text-[#0B4EA2]" />}
                  >
                    My Assigned Tasks ({stats.assignedCases})
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab("complaints")}
                    className="text-xs font-semibold"
                    leftIcon={<FileText className="w-3.5 h-3.5" />}
                  >
                    {t("grievanceQueueTitle", "Grievance Queue")}
                  </Button>
                </div>
              </div>


              {/* ESSENTIAL METRICS: 9 CORE CIVIC KPI CARDS FROM DATABASE */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                {/* 1. Total Complaints */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiTotalComplaints", "Total Complaints")}
                    </span>
                    <FileText className="w-4 h-4 text-[#0B4EA2]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-2 font-mono">
                    {serverStats ? serverStats.total : stats.totalComplaints}
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                    All registered grievances
                  </span>
                </div>

                {/* 2. New Complaints */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiActiveIncidents", "New Complaints")}
                    </span>
                    <Sparkles className="w-4 h-4 text-[#2563EB]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#2563EB] mt-2 font-mono">
                    {serverStats ? serverStats.newComplaints : stats.newComplaints}
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                    Awaiting initial assignment
                  </span>
                </div>

                {/* 3. Pending Complaints */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiPendingVerification", "Pending Complaints")}
                    </span>
                    <Clock className="w-4 h-4 text-[#D97706]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#D97706] mt-2 font-mono">
                    {serverStats ? serverStats.pending : stats.pendingCases}
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                    Assigned & awaiting action
                  </span>
                </div>

                {/* 4. In Progress */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiInProgress", "In Progress")}
                    </span>
                    <RotateCcw className="w-4 h-4 text-[#4F46E5]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#4F46E5] mt-2 font-mono">
                    {serverStats ? serverStats.inProgress : stats.inProgressCases}
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                    Field crews actively working
                  </span>
                </div>

                {/* 5. Resolved Complaints */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiResolved", "Resolved")}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#16A34A] mt-2 font-mono">
                    {serverStats ? serverStats.resolved : stats.resolvedCases}
                  </div>
                  <span className="text-[11px] text-[#16A34A] font-medium mt-1 block">
                    Verified with evidence
                  </span>
                </div>

                {/* 6. Rejected Complaints */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("statusRejected", "Rejected")}
                    </span>
                    <XCircle className="w-4 h-4 text-[#64748B]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#64748B] mt-2 font-mono">
                    {serverStats ? serverStats.rejected : (stats.rejectedCases || 0)}
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                    Invalid or non-civic filings
                  </span>
                </div>

                {/* 7. High Priority Complaints */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiHighPriority", "High Priority")}
                    </span>
                    <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#DC2626] mt-2 font-mono">
                    {serverStats ? serverStats.highPriority : stats.highPriorityCases}
                  </div>
                  <span className="text-[11px] text-[#DC2626] font-medium mt-1 block">
                    {t("kpiHighPriority", "Critical / High")}
                  </span>
                </div>

                {/* 8. Average Resolution Time */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiAvgResolution", "Avg. Resolution Time")}
                    </span>
                    <Clock className="w-4 h-4 text-[#7C3AED]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#7C3AED] mt-2 font-mono">
                    {serverStats && serverStats.avgResolutionHours > 0
                      ? `${serverStats.avgResolutionHours}h`
                      : stats.avgResolutionHours && stats.avgResolutionHours > 0
                      ? `${stats.avgResolutionHours}h`
                      : "< 24h"}
                  </div>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                    {t("kpiAvgResolution", "Avg Resolution")}
                  </span>
                </div>

                {/* 9. Complaint {t("kpiComplianceRate", "Resolution Rate")} */}
                <div className="bg-white dark:bg-[#111827] p-4.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs col-span-2 md:col-span-1 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      {t("kpiComplianceRate", "Resolution Rate")}
                    </span>
                    <TrendingUp className="w-4 h-4 text-[#059669]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#059669] mt-2 font-mono">
                    {serverStats ? `${serverStats.resolutionRate}%` : `${stats.resolutionRate || 0}%`}
                  </div>
                  <span className="text-[11px] text-[#059669] font-medium mt-1 block">
                    {serverStats ? `${serverStats.complianceRate}% Clearance rate` : "Overall clearance"}
                  </span>
                </div>
              </div>

              {/* Map Preview (REAL GOOGLE MAP) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0B4EA2]" />
                    <span>{t("mapHotspots", "Geographic Map & Hotspots")}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab("map")}
                    className="text-xs font-bold text-[#0B4EA2] hover:underline flex items-center gap-1"
                  >
                    <span>Full Map View</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ComplaintsMapView
                  incidents={incidents}
                  onSelectIncident={(inc) => setSelectedIncident(inc)}
                />
              </div>
            </div>
          )}

          {/* ==================== TAB 2: COMPLAINTS TABLE WITH MULTI-LEVEL FILTERS ==================== */}
          {activeTab === "complaints" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                    {t("grievanceQueueTitle", "Complaints Queue")}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                    {t("centralAdminSubtitle", "Central administrative control displaying {count} records.").replace("{count}", String(displayIncidents.length))}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDivisionId("ALL");
                      setSelectedAuthorityId("ALL");
                      setSelectedDepartmentId(adminUser.role !== "SUPER_ADMIN" && adminUser.departmentId ? adminUser.departmentId : "ALL");
                      setFilterPriority("ALL");
                      setFilterStatus("ALL");
                      setFilterDate("ALL");
                      setSearchQuery("");
                    }}
                    className="text-xs"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    {t("resetFilters", "Reset Filters")}
                  </Button>
                </div>
              </div>

              {/* CASCADING HIERARCHICAL FILTER BAR */}
              <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs space-y-3 transition-colors">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t("filterSearchPlaceholder", "Search across ID, title, phone, division, or authority...")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                    />
                  </div>

                  {/* Priority and Date Sort */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "priority") {
                          setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                        } else {
                          setSortBy("priority");
                          setSortOrder("desc");
                        }
                      }}
                      className={cn(
                        "h-10 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors",
                        sortBy === "priority"
                          ? "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]/50"
                          : "bg-white dark:bg-[#161F30] text-[#475569] dark:text-[#94A3B8] border-[#CBD5E1] dark:border-[#2D3748]"
                      )}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Priority ({sortOrder})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "date") {
                          setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                        } else {
                          setSortBy("date");
                          setSortOrder("desc");
                        }
                      }}
                      className={cn(
                        "h-10 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors",
                        sortBy === "date"
                          ? "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] border-[#BFDBFE] dark:border-[#1E40AF]/50"
                          : "bg-white dark:bg-[#161F30] text-[#475569] dark:text-[#94A3B8] border-[#CBD5E1] dark:border-[#2D3748]"
                      )}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Date ({sortOrder})</span>
                    </button>
                  </div>
                </div>

                {/* CASCADING DROPDOWNS: Division -> Authority -> Department -> Priority -> Status -> Date */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-[#F1F5F9] dark:border-[#1E293B] text-xs">
                  {/* Division Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      {t("filterDivision", "1. Division:")}
                    </label>
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => handleDivisionChange(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      <option value="ALL">{t("allDivisions", "All Divisions")}</option>
                      {INITIAL_DIVISIONS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Local Authority Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      {t("filterAuthority", "2. Local Authority:")}
                    </label>
                    <select
                      value={selectedAuthorityId}
                      onChange={(e) => handleAuthorityChange(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      <option value="ALL">{t("allAuthorities", "All Authorities")}</option>
                      {availableAuthorities.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      {t("filterDepartment", "3. Department:")}
                    </label>
                    <select
                      value={selectedDepartmentId}
                      disabled={!isSuperAdmin && Boolean(adminUser.departmentId)}
                      onChange={(e) => setSelectedDepartmentId(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      {(isSuperAdmin || !adminUser.departmentId) && (
                        <option value="ALL">{t("allDepartments", "All Departments")}</option>
                      )}
                      {availableDepartments
                        .filter((dept) => isSuperAdmin || !adminUser.departmentId || dept.id === adminUser.departmentId)
                        .map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      {t("filterPriority", "4. Priority:")}
                    </label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      <option value="ALL">{t("allPriorities", "All Priorities")}</option>
                      <option value="VERY_HIGH">{t("priorityCritical", "CRITICAL")}</option>
                      <option value="HIGH">{t("priorityHigh", "HIGH")}</option>
                      <option value="MEDIUM">{t("priorityMedium", "MEDIUM")}</option>
                      <option value="LOW">{t("priorityLow", "LOW")}</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      {t("filterStatus", "5. Status:")}
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      <option value="ALL">{t("allStatuses", "All Statuses")}</option>
                      <option value="SUBMITTED">{t("statusSubmitted", "SUBMITTED")}</option>
                      <option value="VALIDATING">VALIDATING</option>
                      <option value="ASSIGNED">{t("statusAssigned", "ASSIGNED")}</option>
                      <option value="IN_PROGRESS">{t("statusInProgress", "IN PROGRESS")}</option>
                      <option value="RESOLVED">{t("statusResolved", "RESOLVED")}</option>
                      <option value="ESCALATED">{t("statusOverdue", "ESCALATED")}</option>
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      {t("filterLoggedDate", "6. Logged Date:")}
                    </label>
                    <select
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                    >
                      <option value="ALL">{t("allDates", "All Dates")}</option>
                      <option value="2026-10-06">Today (06 Oct)</option>
                      <option value="2026-10-05">05 Oct 2026</option>
                      <option value="2026-10-04">04 Oct 2026</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Complaints Table */}
              <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs overflow-hidden transition-colors">
                <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC]">
                      {t("masterIncidentsTitle", "All Complaints")} ({displayIncidents.length})
                    </h4>
                    <span className="text-xs text-[#64748B]">
                      {t("masterIncidentsSubtitle", "Citizen grievances filtered by your selection")}
                    </span>
                  </div>
                </div>

                {displayIncidents.length === 0 ? (
                  <div className="p-12 text-center text-[#64748B]">
                    <FileText className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
                    <p className="font-semibold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                      {t("noIncidentsMatching", "No incidents matching the selected filters.")}
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">
                      {t("adjustFiltersAdvice", "Try adjusting division, status, or keyword filters.")}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#475569] dark:text-[#94A3B8] font-bold uppercase tracking-wider text-xs">
                          <th className="py-3 px-4">{t("tableIncidentId", "Incident ID")}</th>
                          <th className="py-3 px-4">{t("tableGrievanceDetails", "Grievance Details")}</th>
                          <th className="py-3 px-4">{t("tableClusterVolume", "Cluster Volume")}</th>
                          <th className="py-3 px-4">{t("tableJurisdiction", "Jurisdiction & Authority")}</th>
                          <th className="py-3 px-4">{t("tablePriority", "Priority")}</th>
                          <th className="py-3 px-4">{t("tableStatus", "Status")}</th>
                          <th className="py-3 px-4">{t("tableAssignedOfficer", "Assigned Officer")}</th>
                          <th className="py-3 px-4">{t("tableReportedDate", "Reported Date")}</th>
                          <th className="py-3 px-4 text-right">{t("tableAction", "Action")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
                        {displayIncidents.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedIncident(item)}
                            className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-[#0B4EA2] dark:text-[#60A5FA]">
                              {item.incidentNumber}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block truncate">
                                {item.title}
                              </span>
                              <span className="text-xs text-[#64748B] block truncate mt-0.5">
                                {item.location}
                              </span>
                              <span className="text-[11px] text-[#0B4EA2] font-semibold block truncate mt-0.5">
                                {item.supportingReports?.[0]?.citizenName || "Citizen"} • {item.supportingReports?.[0]?.citizenMobile || "+91 Mobile"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F172A] dark:bg-[#1E293B] text-white dark:text-[#F8FAFC] border border-transparent dark:border-[#2D3748] font-bold text-xs shadow-2xs">
                                <span>{item.complaintCount}</span>
                                <span className="text-[10px] text-[#94A3B8]">
                                  {item.complaintCount > 1 ? "Reports" : "Report"}
                                </span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] block truncate">
                                {item.authorityName}
                              </span>
                              <span className="text-xs text-[#64748B] block truncate">
                                {item.divisionName} • {item.department}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <PriorityBadge priority={item.priority} size="sm" />
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusBadge status={item.status} size="sm" />
                            </td>
                            <td className="py-3.5 px-4 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                              {item.assignedOfficer ? (
                                <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1">
                                  {item.assignedOfficer}
                                </span>
                              ) : (
                                <span className="text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded text-xs font-bold border border-[#FECACA]">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span className="font-medium text-[#475569] dark:text-[#CBD5E1] block">
                                {item.firstReportedAt || item.lastReportedAt || "Recently reported"}
                              </span>
                              <span className="text-[10px] text-[#64748B] block">
                                Updated: {item.lastReportedAt}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedIncident(item);
                                }}
                                className="text-[#0B4EA2] dark:text-[#60A5FA] hover:text-[#083B7A] dark:hover:text-[#93C5FD] font-bold text-xs inline-flex items-center gap-1 hover:underline p-1"
                              >
                                <span>Inspect Clustered ({item.complaintCount})</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB: MAP & HOTSPOTS ==================== */}
          {activeTab === "map" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                  Geographic Map & Hotspots
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Geographic distribution of {incidents.length} complaints across Kolhapur with small radius hotspot circles and complaint counts.
                </p>
              </div>
              <ComplaintsMapView
                incidents={incidents}
                onSelectIncident={(inc) => setSelectedIncident(inc)}
              />
            </div>
          )}

          {/* ==================== TAB 5: ANALYTICS ==================== */}
          {activeTab === "analytics" && (
            <div className="space-y-4">
              <ComplaintsAnalyticsView />
            </div>
          )}

          {/* ==================== TAB 6: REPORTS ==================== */}
          {activeTab === "reports" && (
            <div className="space-y-4">
              <ComplaintsReportsView complaints={adaptedComplaints} />
            </div>
          )}

          {/* ==================== TAB 7: OFFICERS ==================== */}
          {activeTab === "dept_ops" && isDepartmentAdmin && (
            <DepartmentAdminView
              currentUser={adminUser}
              incidents={displayIncidents}
              onRefreshDashboard={async () => {
                if (token) {
                  const fresh = await fetchAndSyncDatabaseComplaints(token);
                  setIncidents([...fresh]);
                }
              }}
            />
          )}

          {activeTab === "officer" && isOfficer && (
            <OfficerWorkspaceView
              currentUser={adminUser}
              onRefreshDashboard={async () => {
                if (token) {
                  const fresh = await fetchAndSyncDatabaseComplaints(token);
                  setIncidents([...fresh]);
                }
              }}
            />
          )}

          {activeTab === "officers" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                  Field Officers Roster
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Directory of field officers across departments and jurisdictions ({officers.length} active).
                </p>
              </div>
              <OfficersManagementView
                officers={officers}
                complaints={adaptedComplaints}
                onReassignComplaint={handleReassignOfficer}
              />
            </div>
          )}

          {/* ==================== TAB 8: HIERARCHY TOPOLOGY ==================== */}
          {activeTab === "hierarchy" && (
            <div className="space-y-4">
              <HierarchyManagementView />
            </div>
          )}

          {/* ==================== TAB 9: SETTINGS ==================== */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                  Administrative Profile & Credentials
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Verified administrator identity loaded from backend security clearance.
                </p>
              </div>

              <div className="bg-white dark:bg-[#111827] p-6 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs max-w-2xl space-y-5 transition-colors">
                <div className="flex items-center gap-4 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#083B7A] flex items-center justify-center text-white text-xl font-bold shadow-xs">
                    {adminUser.badgeId ? adminUser.badgeId.slice(0, 3) : "ADM"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-[#0F172A] dark:text-[#F8FAFC]">
                        {adminUser.name || "Rajesh Sharma"}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                        Active Admin
                      </span>
                    </div>
                    <p className="text-xs text-[#0B4EA2] font-semibold mt-0.5">
                      {adminUser.designation || "Chief Grievance Redressal Administrator"}
                    </p>
                    <span className="text-xs text-[#64748B]">
                      {adminUser.department || "Municipal Affairs & Intelligence Directorate"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[#64748B] block">Security Badge ID:</span>
                    <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm">
                      {adminUser.badgeId || "ADM-HQ-401"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[#64748B] block">Verified Mobile Number:</span>
                    <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm">
                      {adminUser.mobileNumber || "+91 98220 12345"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[#64748B] block">Administrative Role:</span>
                    <span className="font-bold text-[#0B4EA2] text-sm">
                      {adminUser.role || "ADMIN"} (State Command)
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[#64748B] block">Jurisdiction Scope:</span>
                    <span className="font-bold text-[#15803D] text-sm">
                      All Divisions in Maharashtra
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
                  <Link
                    href={ROUTES.HOME}
                    className="text-xs font-semibold text-[#0B4EA2] hover:underline"
                  >
                    Open CivicResolve Home →
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleSignOut}
                    className="text-xs"
                    leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ASSIGNED WORK MODAL (CLICKABLE FROM DASHBOARD "ASSIGNED WORK" CARD) */}
      <AssignedWorkModal
        isOpen={isAssignedWorkModalOpen}
        onClose={() => setIsAssignedWorkModalOpen(false)}
        incidents={incidents}
        officerName={adminUser.name}
        onSelectIncident={(inc) => setSelectedIncident(inc)}
      />

      {/* INCIDENT DETAILS & CLUSTERED SUPPORTING REPORTS MODAL */}
      <IncidentDetailsModal
        incident={selectedIncident}
        officers={officers}
        onClose={() => setSelectedIncident(null)}
        onReassignOfficer={handleReassignOfficer}
        onUpdateStatus={handleUpdateStatus}
        onOverridePriority={isOfficer ? undefined : handleOverridePriority}
        userRole={adminUser.role}
        departments={availableDepartments.map((d) => ({ id: d.id, name: d.name }))}
        onReassignDepartment={isSuperAdmin ? handleReassignDepartment : undefined}
      />
    </div>
  );
}
