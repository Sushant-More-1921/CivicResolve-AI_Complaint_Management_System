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
  Navigation,
  MapPin,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { PriorityBadge } from "@/components/common/priority-badge";
import { ComplaintsMapView } from "@/components/map/complaints-map-view";
import { ComplaintsAnalyticsView } from "@/components/analytics/complaints-analytics-view";
import { OfficersManagementView } from "@/components/officers/officers-management-view";
import { ComplaintsReportsView } from "@/components/reports/complaints-reports-view";
import { HierarchyManagementView } from "@/components/admin/hierarchy-management-view";
import { AutoRoutingVisualizer } from "@/components/admin/auto-routing-visualizer";
import { AssignedWorkModal } from "@/components/admin/assigned-work-modal";
import { IncidentDetailsModal } from "@/components/admin/incident-details-modal";
import { ClusteringLiveToolbar } from "@/components/admin/clustering-live-toolbar";
import { SuperAdminView } from "@/components/admin/super-admin-view";

import {
  getStoredIncidents,
  queryIncidents,
  computeDashboardStats,
  assignOfficerToIncident,
  updateIncidentStatus,
  incidentToComplaint,
} from "@/lib/db/incidents-db";
import { subscribeToRealTime, emitRealTimeEvent } from "@/lib/realtime/events";
import { MOCK_OFFICERS } from "@/lib/api/officers";
import {
  INITIAL_DIVISIONS,
  INITIAL_AUTHORITIES,
  INITIAL_DEPARTMENTS,
} from "@/lib/api/hierarchy";
import { getSessionUser, getSessionToken, clearSession } from "@/lib/auth/session";
import { updateComplaintStatusApi, assignComplaintOfficerApi } from "@/lib/api/complaints";
import { ComplaintPriority, ComplaintStatus } from "@/types/complaint";
import { MasterIncident, DashboardStats } from "@/types/incident";
import { Officer } from "@/types/officer";
import { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import Link from "next/link";
import ROUTES from "@/config/routes";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { useLanguage } from "@/context/language-context";

type AdminTab =
  | "dashboard"
  | "superadmin"
  | "complaints"
  | "routing"
  | "map"
  | "analytics"
  | "reports"
  | "officers"
  | "hierarchy"
  | "management"
  | "settings";

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
  const router = useRouter();
  const { t } = useLanguage();

  // Navigation state
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Admin session state
  const [adminUser, setAdminUser] = useState<AuthUser>(DEFAULT_ADMIN);
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const sessionToken = getSessionToken();
    const session = getSessionUser();
    if (!sessionToken || !session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
      router.replace(`${ROUTES.AUTH.ADMIN_LOGIN}?redirect=/admin/dashboard`);
      return;
    }

    const timer = setTimeout(() => {
      setToken(sessionToken);
      setAdminUser(session);
      setAuthChecked(true);

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab") as AdminTab | null;
        if (
          tabParam &&
          [
            "dashboard",
            "superadmin",
            "complaints",
            "routing",
            "map",
            "analytics",
            "reports",
            "officers",
            "hierarchy",
            "management",
            "settings",
          ].includes(tabParam)
        ) {
          setActiveTab(tabParam);
        } else if (session.role === "SUPER_ADMIN") {
          setActiveTab("superadmin");
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [router]);

  // Data state: Master Incidents directly connected to dynamic database repository
  const [incidents, setIncidents] = useState<MasterIncident[]>([]);
  const [officers] = useState<Officer[]>(MOCK_OFFICERS);

  // Selected item modal & Assigned Work modal
  const [selectedIncident, setSelectedIncident] = useState<MasterIncident | null>(null);
  const [isAssignedWorkModalOpen, setIsAssignedWorkModalOpen] = useState(false);

  // Initial database load & live real-time subscription
  useEffect(() => {
    let isSubscribed = true;
    const timer = setTimeout(() => {
      if (!isSubscribed) return;
      // 1. Initial load from persistent database
      const initialData = getStoredIncidents();
      setIncidents(initialData);
    }, 0);

    // 2. Real-time subscription: updates dashboard immediately on any database mutation
    const unsubscribe = subscribeToRealTime(() => {
      if (!isSubscribed) return;
      const freshData = getStoredIncidents();
      setIncidents([...freshData]);
    });

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      unsubscribe();
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
    if (selectedAuthorityId === "ALL") return INITIAL_DEPARTMENTS;
    return INITIAL_DEPARTMENTS.filter((d) => d.authorityId === selectedAuthorityId);
  }, [selectedAuthorityId]);

  const handleDivisionChange = (divId: string) => {
    setSelectedDivisionId(divId);
    setSelectedAuthorityId("ALL");
    setSelectedDepartmentId("ALL");
  };

  const handleAuthorityChange = (authId: string) => {
    setSelectedAuthorityId(authId);
    setSelectedDepartmentId("ALL");
  };

  // Filtered Master Incidents based on Admin selections
  const displayIncidents = useMemo(() => {
    if (incidents.length < 0) return [];
    return queryIncidents({
      divisionId: selectedDivisionId,
      authorityId: selectedAuthorityId,
      departmentId: selectedDepartmentId,
      officerId: selectedOfficerId,
      priority: filterPriority,
      status: filterStatus,
      search: searchQuery,
    }).sort((a, b) => {
      if (sortBy === "count") {
        return sortOrder === "desc" ? b.complaintCount - a.complaintCount : a.complaintCount - b.complaintCount;
      }
      if (sortBy === "priority") {
        const pOrder: Record<ComplaintPriority, number> = {
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
    });
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

  const sidebarLinks: { id: AdminTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "dashboard", label: "Admin Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    ...(isSuperAdmin
      ? [
          {
            id: "superadmin" as AdminTab,
            label: "Super Admin Console",
            icon: <Shield className="w-4 h-4 text-[#B45309]" />,
            badge: "Exclusive",
          },
        ]
      : []),
    {
      id: "complaints",
      label: "Manage Complaints",
      icon: <FileText className="w-4 h-4" />,
      badge: `${incidents.length}`,
    },
    { id: "routing", label: "Auto Routing Pipeline", icon: <Navigation className="w-4 h-4" /> },
    { id: "map", label: "Map & Hotspots", icon: <Map className="w-4 h-4" /> },
    { id: "analytics", label: "Reports & Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "reports", label: "Audit Reports", icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: "officers", label: "Manage Officers", icon: <Users className="w-4 h-4" />, badge: `${officers.length}` },
    { id: "hierarchy", label: "Hierarchy Topology", icon: <FolderTree className="w-4 h-4" /> },
    { id: "management", label: "SLA Management", icon: <Sliders className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center p-8 bg-white border border-[#CBD5E1] rounded-2xl shadow-xs">
          <div className="w-10 h-10 border-3 border-[#083B7A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#0F172A]">Verifying Admin Credentials...</h2>
          <p className="text-xs text-[#64748B] mt-1">Authorized Department Personnel Only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col selection:bg-[#EAF2FF] selection:text-[#0B4EA2]">
      {/* TOP HEADER WITH BRANDING & STATIC ADMIN PROFILE */}
      <header className="w-full bg-white border-b border-[#E2E8F0] h-16 px-4 sm:px-6 sticky top-0 z-40 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0B4EA2] flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-sm sm:text-base font-bold text-[#0F172A] leading-tight">
                CivicResolve Administration Portal
              </span>
              <span className="hidden sm:block text-[11px] font-medium text-[#64748B]">
                Directorate of Municipal Services • Officer Console
              </span>
            </div>
          </div>
        </div>

        {/* Right header actions: Static Admin Identity, Alerts, Sign out, Language */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <LanguageSwitcher />

          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("superadmin")}
              className={`text-xs h-9 border-[#B45309] text-[#B45309] hover:bg-[#FFF7E6] font-semibold ${
                activeTab === "superadmin" ? "bg-[#FFF7E6]" : ""
              }`}
              leftIcon={<Shield className="w-3.5 h-3.5 text-[#B45309]" />}
            >
              Super Admin Console
            </Button>
          )}

          {/* Static Admin Profile (Loaded from backend login session) */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
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
                <span className="font-bold text-xs text-[#0F172A] leading-tight">
                  {adminUser.name || (isSuperAdmin ? "Sushant More" : "Rajesh Sharma")}
                </span>
                {isSuperAdmin ? (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#FFF7E6] text-[#B45309] border border-[#FDE68A] flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-[#B45309]" />
                    SUPER ADMIN
                  </span>
                ) : (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#EAF2FF] text-[#0B4EA2] border border-[#BFDBFE]">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#64748B] font-medium block">
                {adminUser.badgeId || (isSuperAdmin ? "MH-SADM-01" : "ADM-HQ-401")} • {adminUser.designation || (isSuperAdmin ? "Super Administrator" : "Administrator")}
              </span>
            </div>
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {criticalIncidents.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#DC2626] rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-[#CBD5E1] shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-3">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#0F172A]">
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
                        className="p-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2]/40 hover:bg-[#FEF2F2] cursor-pointer transition-colors text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#DC2626]">
                            {c.incidentNumber}
                          </span>
                          <PriorityBadge priority={c.priority} size="sm" />
                        </div>
                        <p className="font-semibold text-[#0F172A] truncate">{c.title}</p>
                        <span className="text-[11px] text-[#64748B] block truncate">
                          📍 {c.authorityName} • {c.location} • {c.complaintCount} reports
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
            Logout
          </Button>
        </div>
      </header>

      {/* MAIN LAYOUT: SIDEBAR + CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-[#E2E8F0] pt-16 md:pt-0 transform md:relative md:translate-x-0 transition-transform duration-200 ease-in-out flex flex-col justify-between",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="py-5 px-3 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              Central Administration
            </div>
            {sidebarLinks.map((link) => (
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
                    ? "bg-[#0B4EA2] text-white font-semibold shadow-xs"
                    : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
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
                        : "bg-[#F1F5F9] text-[#475569]"
                    )}
                  >
                    {link.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[#0F172A] font-semibold">
              <span>Jurisdiction Engine</span>
              <span className="text-[#16A34A] font-semibold text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                Operational
              </span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Auto-Routing: GPS $\rightarrow$ Division $\rightarrow$ Auth $\rightarrow$ Officer
            </p>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                    Admin Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                    Centralized platform monitoring complaints, SLA compliance, and officer dispatch across jurisdictions.
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
                    Grievance Queue
                  </Button>
                </div>
              </div>

              {/* WORKFLOW SIMULATION TOOLBAR */}
              <ClusteringLiveToolbar onRefresh={() => setIncidents([...getStoredIncidents()])} />

              {/* ESSENTIAL METRICS: 4 CORE CIVIC KPI CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Complaints */}
                <div className="bg-white p-5 rounded-xl border border-[#CBD5E1] shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      Total Complaints
                    </span>
                    <FileText className="w-4 h-4 text-[#0B4EA2]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#0F172A] mt-2 font-mono">
                    {stats.totalComplaints}
                  </div>
                  <span className="text-xs text-[#64748B] mt-1 block">
                    Citizen reports logged
                  </span>
                </div>

                {/* 2. Pending */}
                <div className="bg-white p-5 rounded-xl border border-[#CBD5E1] shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      Pending
                    </span>
                    <Clock className="w-4 h-4 text-[#D97706]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#D97706] mt-2 font-mono">
                    {stats.pendingCases + stats.unassignedCases}
                  </div>
                  <span className="text-xs text-[#64748B] mt-1 block">
                    {stats.unassignedCases} unassigned • {stats.pendingCases} in progress
                  </span>
                </div>

                {/* 3. High Priority */}
                <div className="bg-white p-5 rounded-xl border border-[#CBD5E1] shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      High Priority
                    </span>
                    <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#DC2626] mt-2 font-mono">
                    {stats.highPriorityCases}
                  </div>
                  <span className="text-xs text-[#64748B] mt-1 block">
                    Critical & safety issues
                  </span>
                </div>

                {/* 4. Resolved */}
                <div className="bg-white p-5 rounded-xl border border-[#CBD5E1] shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      Resolved
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-[#16A34A] mt-2 font-mono">
                    {stats.resolvedCases}
                  </div>
                  <span className="text-xs text-[#64748B] mt-1 block">
                    Remediated with evidence
                  </span>
                </div>
              </div>

              {/* Map Preview (REAL GOOGLE MAP) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0B4EA2]" />
                    <span>Statewide Interactive Google Map & Hotspots</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                    Grievance Queue & Multi-Tier Records
                  </h1>
                  <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                    Central administrative control displaying {displayIncidents.length} records.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDivisionId("ALL");
                      setSelectedAuthorityId("ALL");
                      setSelectedDepartmentId("ALL");
                      setFilterPriority("ALL");
                      setFilterStatus("ALL");
                      setFilterDate("ALL");
                      setSearchQuery("");
                    }}
                    className="text-xs"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Reset Filters
                  </Button>
                </div>
              </div>

              {/* CASCADING HIERARCHICAL FILTER BAR */}
              <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search across ID, title, phone, division, or authority..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0B4EA2]"
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
                          ? "bg-[#EAF2FF] text-[#0B4EA2] border-[#BFDBFE]"
                          : "bg-white text-[#475569] border-[#CBD5E1]"
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
                          ? "bg-[#EAF2FF] text-[#0B4EA2] border-[#BFDBFE]"
                          : "bg-white text-[#475569] border-[#CBD5E1]"
                      )}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Date ({sortOrder})</span>
                    </button>
                  </div>
                </div>

                {/* CASCADING DROPDOWNS: Division -> Authority -> Department -> Priority -> Status -> Date */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-[#F1F5F9] text-xs">
                  {/* Division Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      1. Division:
                    </label>
                    <select
                      value={selectedDivisionId}
                      onChange={(e) => handleDivisionChange(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      <option value="ALL">All Divisions</option>
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
                      2. Local Authority:
                    </label>
                    <select
                      value={selectedAuthorityId}
                      onChange={(e) => handleAuthorityChange(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      <option value="ALL">All Authorities</option>
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
                      3. Department:
                    </label>
                    <select
                      value={selectedDepartmentId}
                      onChange={(e) => setSelectedDepartmentId(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      <option value="ALL">All Departments</option>
                      {availableDepartments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      4. Priority:
                    </label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      <option value="ALL">All Priorities</option>
                      <option value="VERY_HIGH">VERY HIGH</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      5. Status:
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="VALIDATING">VALIDATING</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="ESCALATED">ESCALATED</option>
                    </select>
                  </div>

                  {/* Date Filter */}
                  <div>
                    <label className="text-[10px] uppercase font-bold text-[#64748B] block mb-1">
                      6. Logged Date:
                    </label>
                    <select
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A]"
                    >
                      <option value="ALL">All Dates</option>
                      <option value="2026-10-06">Today (06 Oct)</option>
                      <option value="2026-10-05">05 Oct 2026</option>
                      <option value="2026-10-04">04 Oct 2026</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Complaints Table */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-[#0F172A]">
                      Master Incident & Clustered Grievance Records ({displayIncidents.length})
                    </h4>
                    <span className="text-xs text-[#64748B]">
                      Consolidated multi-citizen complaints grouped by proximity, category, and time window
                    </span>
                  </div>
                </div>

                {displayIncidents.length === 0 ? (
                  <div className="p-12 text-center text-[#64748B]">
                    <FileText className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
                    <p className="font-semibold text-sm text-[#0F172A]">
                      No incidents matching the selected filters.
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">
                      Try adjusting division, status, or keyword filters.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#475569] font-bold uppercase tracking-wider text-xs">
                          <th className="py-3 px-4">Incident ID</th>
                          <th className="py-3 px-4">Grievance Details</th>
                          <th className="py-3 px-4">Cluster Volume</th>
                          <th className="py-3 px-4">Jurisdiction & Authority</th>
                          <th className="py-3 px-4">Priority</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Assigned Officer</th>
                          <th className="py-3 px-4">SLA Deadline</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {displayIncidents.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedIncident(item)}
                            className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-4 font-mono font-bold text-[#0B4EA2]">
                              {item.incidentNumber}
                            </td>
                            <td className="py-3.5 px-4 max-w-xs">
                              <span className="font-bold text-[#0F172A] block truncate">
                                {item.title}
                              </span>
                              <span className="text-xs text-[#64748B] block truncate mt-0.5">
                                📍 {item.location}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F172A] text-white font-bold text-xs shadow-2xs">
                                <span>{item.complaintCount}</span>
                                <span className="text-[10px] text-[#94A3B8]">
                                  {item.complaintCount > 1 ? "Reports" : "Report"}
                                </span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-[#0F172A] block truncate">
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
                            <td className="py-3.5 px-4 font-medium text-[#0F172A]">
                              {item.assignedOfficer ? (
                                <span className="font-semibold text-[#0F172A] flex items-center gap-1">
                                  <span>👤</span> {item.assignedOfficer}
                                </span>
                              ) : (
                                <span className="text-[#DC2626] bg-[#FEF2F2] px-2 py-0.5 rounded text-xs font-bold border border-[#FECACA]">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span
                                className={cn(
                                  "font-medium block",
                                  item.isSlaBreached ? "text-[#DC2626] font-bold" : "text-[#475569]"
                                )}
                              >
                                {item.slaDeadline}
                              </span>
                              <span className="text-[10px] text-[#64748B] block">
                                Last: {item.lastReportedAt}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedIncident(item);
                                }}
                                className="text-[#0B4EA2] hover:text-[#083B7A] font-bold text-xs inline-flex items-center gap-1 hover:underline p-1"
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

          {/* ==================== TAB 3: AUTO-ROUTING PIPELINE ==================== */}
          {activeTab === "routing" && (
            <div className="space-y-4">
              <AutoRoutingVisualizer />
            </div>
          )}

          {/* ==================== TAB 4: MAP & HOTSPOTS (GOOGLE MAPS PLATFORM) ==================== */}
          {activeTab === "map" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  Statewide Geospatial Google Map & Density Hotspots
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                  Centralized command map displaying all {incidents.length} Master Incidents and clustered citizen grievances across Maharashtra.
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
          {activeTab === "officers" && (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  Statewide Field Officers Directory & Roster
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                  Central roster of {officers.length} field officers across all divisions and municipal authorities.
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

          {/* ==================== TAB 9: SLA MANAGEMENT ==================== */}
          {activeTab === "management" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  Statewide Response SLA & Escalation Governance
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                  Configure automated response time ceilings and cross-division escalation policies.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs space-y-4">
                  <h4 className="font-bold text-sm sm:text-base text-[#0F172A] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0B4EA2]" />
                    <span>Response SLA Thresholds by Severity</span>
                  </h4>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2]">
                      <div>
                        <strong className="text-[#DC2626]">VERY HIGH (Critical Public Safety)</strong>
                        <p className="text-[#64748B]">Immediate bio-waste, pipeline rupture</p>
                      </div>
                      <span className="font-bold text-[#DC2626] font-mono">4 Hours SLA</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#FDE68A] bg-[#FFF7E6]">
                      <div>
                        <strong className="text-[#B45309]">HIGH (Urgent Civil Disruption)</strong>
                        <p className="text-[#64748B]">Road potholes, arterial streetlights</p>
                      </div>
                      <span className="font-bold text-[#B45309] font-mono">12 Hours SLA</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#BFDBFE] bg-[#EAF2FF]">
                      <div>
                        <strong className="text-[#0B4EA2]">MEDIUM</strong>
                        <p className="text-[#64748B]">Drain cleaning, secondary dumpsters</p>
                      </div>
                      <span className="font-bold text-[#0B4EA2] font-mono">24 Hours SLA</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-[#BBF7D0] bg-[#ECFDF3]">
                      <div>
                        <strong className="text-[#15803D]">LOW</strong>
                        <p className="text-[#64748B]">General maintenance queries</p>
                      </div>
                      <span className="font-bold text-[#15803D] font-mono">48 Hours SLA</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs space-y-4">
                  <h4 className="font-bold text-sm sm:text-base text-[#0F172A] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#5B21B6]" />
                    <span>Hierarchical Escalation Watchdog</span>
                  </h4>
                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-lg border border-[#E2E8F0] space-y-1">
                      <strong className="text-[#0F172A] block">Level 1 Escalation: Officer → Authority Head</strong>
                      <span className="text-[#64748B]">
                        If unassigned for &gt; 2 hours or no site visit within SLA ceiling, escalate to Municipal Commissioner.
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-[#E2E8F0] space-y-1">
                      <strong className="text-[#0F172A] block">Level 2 Escalation: Authority → Division Commissioner</strong>
                      <span className="text-[#64748B]">
                        If resolution fails past 2x SLA limit, flagged to Divisional Commissioner console.
                      </span>
                    </div>

                    <div className="p-3 rounded-lg border border-[#E2E8F0] space-y-1">
                      <strong className="text-[#0F172A] block">Level 3 Escalation: State Secretary Audit</strong>
                      <span className="text-[#64748B]">
                        Recurring hotspot breaches flagged in monthly Cabinet Redressal Index.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 10: SETTINGS ==================== */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                  Administrative Profile & Credentials
                </h1>
                <p className="text-xs sm:text-sm text-[#64748B] mt-1">
                  Verified administrator identity loaded from backend security clearance.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-xs max-w-2xl space-y-5">
                <div className="flex items-center gap-4 border-b border-[#E2E8F0] pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#083B7A] flex items-center justify-center text-white text-xl font-bold shadow-xs">
                    {adminUser.badgeId ? adminUser.badgeId.slice(0, 3) : "ADM"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-lg text-[#0F172A]">
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
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block">Security Badge ID:</span>
                    <span className="font-mono font-bold text-[#0F172A] text-sm">
                      {adminUser.badgeId || "ADM-HQ-401"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block">Verified Mobile Number:</span>
                    <span className="font-mono font-bold text-[#0F172A] text-sm">
                      {adminUser.mobileNumber || "+91 98220 12345"}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block">Administrative Role:</span>
                    <span className="font-bold text-[#0B4EA2] text-sm">
                      {adminUser.role || "ADMIN"} (State Command)
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                    <span className="text-[#64748B] block">Jurisdiction Scope:</span>
                    <span className="font-bold text-[#15803D] text-sm">
                      All Divisions in Maharashtra
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
                  <Link
                    href="/auth/citizenlogin"
                    className="text-xs font-semibold text-[#0B4EA2] hover:underline"
                  >
                    Open CivicResolve Citizen Portal →
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
      />
    </div>
  );
}
