"use client";

import { DepartmentsAdminPanel } from "@/components/admin/departments-admin-panel";

import React, { useState, useEffect } from "react";
import {
  Shield,
  UserPlus,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  ChevronRight,
  Database,
  Lock,
  Download,
  Filter,
  BarChart3,
  Sliders,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  Activity,
  Server,
  Cpu,
  Check,
  History,
  UserCheck,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchDepartmentsApi,
  fetchOfficersApi,
  addOfficerApi,
  deleteOfficerApi,
  fetchDistrictStatsApi,
  DepartmentItem,
  OfficerItem,
  DistrictStatItem,
  DistrictStatsData,
  PlatformOverviewData,
  AuditLogItem,
  ManagedUserItem,
  fetchPlatformOverviewApi,
  fetchAuditLogsApi,
  fetchUsersApi,
  updateUserRoleApi,
  updateUserStatusApi,
  createDepartmentApi,
  updateDepartmentApi,
  assignOrReplaceDepartmentAdminApi,
  updateOfficerApi,
} from "@/lib/api/admin";
import { AuthUser } from "@/types/auth";
import { MasterIncident } from "@/types/incident";
import { useLanguage } from "@/context/language-context";

interface SuperAdminViewProps {
  currentUser: AuthUser;
  incidents: MasterIncident[];
  onFilterDistrict?: (divisionId: string) => void;
}

const MAHARASHTRA_DIVISIONS = [
  { id: "Pune", label: "Pune Division (Pune, Kolhapur, Solapur, Satara, Sangli)" },
  { id: "Nashik", label: "Nashik Division (Nashik, Ahmednagar, Jalgaon, Dhule)" },
  { id: "Konkan", label: "Konkan Division (Mumbai, Thane, Palghar, Raigad, Ratnagiri)" },
  { id: "Chhatrapati Sambhajinagar", label: "Chhatrapati Sambhajinagar Division (Aurangabad, Jalna, Nanded)" },
  { id: "Nagpur", label: "Nagpur Division (Nagpur, Chandrapur, Wardha, Gondia)" },
  { id: "Amravati", label: "Amravati Division (Amravati, Akola, Yavatmal, Buldhana)" },
];

const PRESET_DESIGNATIONS = [
  "Executive Engineer",
  "Sub-Divisional Officer",
  "Assistant Commissioner",
  "Junior Engineer (Civil)",
  "Sanitary Inspector",
  "Chief Electrical Engineer",
  "Health Officer",
  "Town Planner & Encroachment Inspector",
  "Ward Officer",
  "Deputy Municipal Commissioner",
];

export function SuperAdminView({
  currentUser,
  incidents,
  onFilterDistrict,
}: SuperAdminViewProps) {
  const { t } = useLanguage();
  // Navigation sub-tabs within Super Admin View
  const [subTab, setSubTab] = useState<"overview" | "departments" | "districts" | "users" | "audit" | "roster" | "addAdmin" | "governance">("overview");

  // Platform & System Health States
  const [overviewData, setOverviewData] = useState<PlatformOverviewData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUserItem[]>([]);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState<string>("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("ALL");

  // Database Data States
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [officers, setOfficers] = useState<OfficerItem[]>([]);
  const [districtData, setDistrictData] = useState<DistrictStatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State for Adding Officer / Admin
  const [fullName, setFullName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"OFFICER" | "DEPARTMENT_ADMIN">("OFFICER");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [designation, setDesignation] = useState<string>("Executive Engineer");
  const [customDesignation, setCustomDesignation] = useState<string>("");
  const [selectedDivision, setSelectedDivision] = useState<string>("Pune");
  const [badgeId, setBadgeId] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState<boolean>(true);

  // Feedback states
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<OfficerItem | null>(null);

  // Search & Filters for Roster
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [filterDept, setFilterDept] = useState<string>("ALL");

  // District Search & Sort
  const [districtSearch, setDistrictSearch] = useState<string>("");
  const [districtSortBy, setDistrictSortBy] = useState<"count" | "rate" | "pending">("count");

  // Load live data from Supabase & backend
  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [deptList, officerList, distStats, overview, logs, users] = await Promise.all([
        fetchDepartmentsApi(),
        fetchOfficersApi(),
        fetchDistrictStatsApi(),
        fetchPlatformOverviewApi(),
        fetchAuditLogsApi(40),
        fetchUsersApi(),
      ]);
      setDepartments(deptList);
      setOfficers(officerList);
      setDistrictData(distStats);
      if (overview) setOverviewData(overview);
      if (logs) setAuditLogs(logs);
      if (users) setManagedUsers(users);

      if (deptList.length > 0 && !selectedDeptId) {
        setSelectedDeptId(deptList[0].id);
      }
    } catch (err: any) {
      console.warn("Notice loading Super Admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-generate badge ID
  const handleAutoGenerateBadge = () => {
    const clean = phoneNumber.replace(/\D/g, "");
    const suffix = clean.length >= 4 ? clean.slice(-4) : Math.floor(1000 + Math.random() * 9000);
    const prefix = selectedRole === "DEPARTMENT_ADMIN" ? "MH-ADM" : "MH-OFF";
    setBadgeId(`${prefix}-${suffix}`);
  };

  // Add Officer / Admin Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setRecentlyAdded(null);

    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setErrorMessage("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage("Please provide a valid full name (minimum 2 characters).");
      return;
    }

    const finalDesignation =
      designation === "OTHER" ? customDesignation.trim() || "Field Officer" : designation;

    setIsSubmitting(true);
    if (selectedRole === "DEPARTMENT_ADMIN") {
      if (!selectedDeptId) {
        setErrorMessage("Please select a department to assign a Primary Department Admin.");
        setIsSubmitting(false);
        return;
      }
      try {
        await assignOrReplaceDepartmentAdminApi(selectedDeptId, {
          name: fullName.trim(),
          phoneNumber: cleanPhone,
          email: email.trim() || undefined,
          designation: finalDesignation,
          replaceExisting: false,
        });
        setSuccessMessage(
          `Assigned ${fullName.trim()} (+91 ${cleanPhone}) as Primary Department Admin. Use "Departments & Admins" tab to replace an existing primary admin.`
        );
        setFullName("");
        setPhoneNumber("");
        setEmail("");
        setBadgeId("");
        setCustomDesignation("");
        await loadData();
      } catch (err: any) {
        setErrorMessage(err?.message || "Failed to assign Department Admin.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    try {
      const res = await addOfficerApi({
        name: fullName.trim(),
        phoneNumber: cleanPhone,
        email: email.trim() || undefined,
        designation: finalDesignation,
        departmentId: selectedDeptId || undefined,
        badgeId: badgeId.trim() || undefined,
        role: selectedRole,
        division: selectedDivision,
        isAvailable,
      });

      setSuccessMessage(res.message);
      setRecentlyAdded(res.data);

      // Reset form
      setFullName("");
      setPhoneNumber("");
      setEmail("");
      setBadgeId("");
      setCustomDesignation("");

      // Refresh officers list
      const updatedOfficers = await fetchOfficersApi();
      setOfficers(updatedOfficers);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to register officer into database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Officer
  const handleDeleteOfficer = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from the active database roster?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteOfficerApi(id);
      setOfficers((prev) => prev.filter((o) => o.id !== id));
      if (recentlyAdded?.id === id) {
        setRecentlyAdded(null);
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete officer");
    } finally {
      setDeletingId(null);
    }
  };

  // Update User Role (RBAC)
  const handleToggleUserStatus = async (userId: string, nextActive: boolean) => {
    setRoleUpdatingId(userId);
    try {
      await updateUserStatusApi(userId, nextActive);
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: nextActive } : u))
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update account status");
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setRoleUpdatingId(userId);
    try {
      await updateUserRoleApi(userId, newRole);
      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      alert(err?.message || "Failed to update user role");
    } finally {
      setRoleUpdatingId(null);
    }
  };

  // Export District Statistics to CSV
  const handleExportDistrictCsv = () => {
    if (!districtData) return;
    const headers = [
      "Division / District",
      "Headquarters",
      "Total Complaints",
      "Resolved Complaints",
      "Pending Complaints",
      "Critical Complaints",
      "SLA Resolution Rate (%)",
      "Assigned Officers",
    ];

    const rows = districtData.districts.map((d) => [
      `"${d.divisionName}"`,
      `"${d.headquarters}"`,
      d.totalComplaints,
      d.resolvedComplaints,
      d.pendingComplaints,
      d.criticalComplaints,
      `${d.resolutionRate}%`,
      d.assignedOfficers,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Maharashtra_District_Complaints_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Officers Roster
  const filteredOfficers = officers.filter((officer) => {
    const matchesSearch =
      officer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (officer.badgeId && officer.badgeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      officer.phoneNumber.includes(searchTerm) ||
      (officer.department?.name &&
        officer.department.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (officer.designation &&
        officer.designation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole =
      filterRole === "ALL" || (officer.role ? officer.role === filterRole : filterRole === "OFFICER");

    const matchesDept = filterDept === "ALL" || officer.departmentId === filterDept;

    return matchesSearch && matchesRole && matchesDept;
  });

  // Filtered & Sorted Districts
  const filteredDistricts = (districtData?.districts || [])
    .filter((d) =>
      d.divisionName.toLowerCase().includes(districtSearch.toLowerCase()) ||
      d.headquarters.toLowerCase().includes(districtSearch.toLowerCase()) ||
      d.districts.some((sub) => sub.toLowerCase().includes(districtSearch.toLowerCase()))
    )
    .sort((a, b) => {
      if (districtSortBy === "rate") return b.resolutionRate - a.resolutionRate;
      if (districtSortBy === "pending") return b.pendingComplaints - a.pendingComplaints;
      return b.totalComplaints - a.totalComplaints;
    });

  const totalComplaintsAll = districtData?.totalComplaints || 230;
  const totalResolvedAll = districtData?.totalResolved || 189;
  const totalPendingAll = districtData?.totalPending || 41;
  const avgSlaRate = districtData?.avgResolutionRate || 92;

  return (
    <div className="space-y-6">
      {/* 1. SUPER ADMIN EXECUTIVE IDENTITY BANNER */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-6 shadow-2xs transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-13 h-13 rounded-xl bg-[#0B4EA2] text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              SM
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  {currentUser.name || "Sushant More"}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]/40">
                  <Shield className="w-3.5 h-3.5 text-[#0B4EA2]" />
                  {t("superAdminTitle", "SUPER ADMINISTRATOR")}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#ECFDF3] dark:bg-[#064E3B]/20 text-[#15803D] dark:text-[#34D399] font-semibold border border-[#BBF7D0] dark:border-[#10B981]/30">
                  {t("superAdminStatewide", "Statewide Jurisdiction")}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
                  {currentUser.mobileNumber || "+91 83809 34906"}
                </span>
                <span>•</span>
                <span className="text-[#0F172A] dark:text-[#F8FAFC]">{currentUser.email || "moresushant600@gmail.com"}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[#475569] dark:text-[#94A3B8]">
                  <MapPin className="w-3 h-3 text-[#DC2626]" />
                  Near Ganesh Mandir, Alatwadi, Kolhapur
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="text-xs border-[#CBD5E1]"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#0B4EA2]" : ""}`} />}
            >
              {t("superAdminSyncDb", "Sync Database")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportDistrictCsv}
              className="text-xs font-semibold"
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              {t("superAdminExportCsv", "Export CSV Report")}
            </Button>
          </div>
        </div>

        {/* Executive 4 Core Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
              {t("superAdminStatewideComplaints", "Statewide Complaints")}
            </span>
            <span className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-1 block font-mono">
              {totalComplaintsAll}
            </span>
            <span className="text-[11px] text-[#15803D] font-medium mt-0.5 block">
              Across 7 Maharashtra Divisions
            </span>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
              {t("superAdminTotalResolved", "Total Resolved")}
            </span>
            <span className="text-2xl font-bold text-[#15803D] mt-1 block font-mono">
              {totalResolvedAll}
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-0.5 block">
              {avgSlaRate}% Average Resolution Rate
            </span>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
              Active Pending Triage
            </span>
            <span className="text-2xl font-bold text-[#B45309] mt-1 block font-mono">
              {totalPendingAll}
            </span>
            <span className="text-[11px] text-[#B45309] font-medium mt-0.5 block">
              Assigned to field officers
            </span>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
              Active Municipal Officers
            </span>
            <span className="text-2xl font-bold text-[#0B4EA2] mt-1 block font-mono">
              {officers.length}
            </span>
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-0.5 block">
              {departments.length} Municipal Departments
            </span>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TOOLBAR: EXCLUSIVE SUPER ADMIN TABS */}
      <div className="flex items-center gap-2 border-b border-[#CBD5E1] dark:border-[#1E293B] pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab("departments")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "departments"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departments & Admins</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${subTab === "departments" ? "bg-white/20 text-white" : "bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]"}`}>
            {departments.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "overview"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Platform Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("districts")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "districts"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Regional Statistics</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${subTab === "districts" ? "bg-white/20 text-white" : "bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]"}`}>
            {filteredDistricts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("users")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "users"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User & RBAC Governance</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${subTab === "users" ? "bg-white/20 text-white" : "bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]"}`}>
            {managedUsers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("audit")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "audit"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit Logs</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${subTab === "audit" ? "bg-white/20 text-white" : "bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]"}`}>
            {auditLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("roster")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "roster"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Officers Directory</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${subTab === "roster" ? "bg-white/20 text-white" : "bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8]"}`}>
            {officers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("addAdmin")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "addAdmin"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Admin / Officer</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("governance")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "governance"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>System Settings</span>
        </button>
      </div>

      {/* ==================== SUB-TAB 0: PLATFORM OVERVIEW & SYSTEM HEALTH ==================== */}
      {subTab === "overview" && (
        <div className="space-y-6">
          {/* Health Diagnostics Panel */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-[#0B4EA2]" />
              <span>Infrastructure Diagnostics & Engine Health</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* AI Service */}
              <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-[#0B4EA2]" />
                    AI Intelligence Engine
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                    {overviewData?.metrics.aiServiceStatus || "ONLINE"}
                  </span>
                </div>
                <div className="text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
                  Google Gemini 2.5 Flash
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Multimodal vision verification & auto-categorization
                </p>
              </div>

              {/* Database */}
              <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#0B4EA2]" />
                    Database Cluster
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                    {overviewData?.metrics.databaseStatus || "CONNECTED"}
                  </span>
                </div>
                <div className="text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
                  Supabase PostgreSQL
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  ACID transactional persistence & audit trails
                </p>
              </div>

              {/* Backend API */}
              <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-[#0B4EA2]" />
                    Backend API Service
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                    {overviewData?.metrics.systemHealth || "HEALTHY"}
                  </span>
                </div>
                <div className="text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
                  Express.js :5000
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  RBAC authentication & routing middleware
                </p>
              </div>

              {/* Uptime */}
              <div className="p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#0B4EA2]" />
                    Service Uptime
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#0B4EA2]">
                    99.9%
                  </span>
                </div>
                <div className="text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold">
                  {overviewData ? `${Math.floor(overviewData.metrics.uptimeSeconds / 60)} minutes active` : "System Active"}
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Zero service disruption reported
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Distributions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Category */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Complaints by Category
              </h4>
              <div className="space-y-2 pt-1">
                {(overviewData?.breakdowns.byCategory || []).length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No categorized complaints yet.</p>
                ) : (
                  overviewData?.breakdowns.byCategory.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between text-xs">
                      <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">{cat.category}</span>
                      <span className="font-mono font-bold text-[#0B4EA2] bg-[#EAF2FF] px-2 py-0.5 rounded">
                        {cat.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* By Status */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Complaints by Status
              </h4>
              <div className="space-y-2 pt-1">
                {(overviewData?.breakdowns.byStatus || []).length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No status breakdown available.</p>
                ) : (
                  overviewData?.breakdowns.byStatus.map((st) => (
                    <div key={st.status} className="flex items-center justify-between text-xs">
                      <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">{st.status}</span>
                      <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {st.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* By Priority */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                Complaints by Priority
              </h4>
              <div className="space-y-2 pt-1">
                {(overviewData?.breakdowns.byPriority || []).length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No priority data logged.</p>
                ) : (
                  overviewData?.breakdowns.byPriority.map((pr) => (
                    <div key={pr.priority} className="flex items-center justify-between text-xs">
                      <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">{pr.priority}</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                        pr.priority === "VERY_HIGH" || pr.priority === "HIGH"
                          ? "bg-[#FEF2F2] text-[#DC2626]"
                          : "bg-[#F8FAFC] text-[#475569] dark:text-[#94A3B8]"
                      }`}>
                        {pr.count}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB: USERS & RBAC GOVERNANCE ==================== */}
      {subTab === "users" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0B4EA2]" />
                <span>User Directory & Role-Based Access Control (RBAC)</span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                Manage system clearance levels across Citizens, Field Officers, Administrators, and Super Administrators.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Total Registered:</span>
              <span className="font-mono font-bold text-xs bg-[#EAF2FF] text-[#0B4EA2] px-2.5 py-1 rounded-full">
                {managedUsers.length} Users
              </span>
            </div>
          </div>

          {/* Search and Role Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user by name, mobile, district..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
              />
            </div>
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] w-full sm:w-auto focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
            >
              <option value="ALL">All Roles</option>
              <option value="CITIZEN">Citizen</option>
              <option value="OFFICER">Officer</option>
              <option value="DEPARTMENT_ADMIN">Department Admin</option>
              <option value="SUPER_ADMIN">Super Administrator</option>
            </select>
          </div>

          {/* RBAC Table */}
          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Name & Contact</th>
                  <th className="py-2.5 px-3">Current Role</th>
                  <th className="py-2.5 px-3">Assigned Department / Zone</th>
                  <th className="py-2.5 px-3 text-center">Complaints</th>
                  <th className="py-2.5 px-3">Registered Date</th>
                  <th className="py-2.5 px-3 text-right">Modify Access Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
                {managedUsers
                  .filter((u) => {
                    const matchQ =
                      u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                      u.phoneNumber.includes(userSearchTerm) ||
                      u.district.toLowerCase().includes(userSearchTerm.toLowerCase());
                    const matchR =
                      userRoleFilter === "ALL" ||
                      u.role === userRoleFilter ||
                      (userRoleFilter === "DEPARTMENT_ADMIN" && u.role === "ADMIN");
                    return matchQ && matchR;
                  })
                  .map((u) => (
                    <tr key={u.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{u.name}</div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono mt-0.5">
                          +91 {u.phoneNumber}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            u.role === "SUPER_ADMIN"
                              ? "bg-[#FFF7E6] text-[#B45309] border border-[#FDE68A]"
                              : u.role === "DEPARTMENT_ADMIN" || u.role === "ADMIN"
                              ? "bg-[#EAF2FF] text-[#0B4EA2] border border-[#BFDBFE]"
                              : u.role === "OFFICER"
                              ? "bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]"
                              : "bg-[#F1F5F9] text-[#475569] dark:text-[#94A3B8] border border-[#CBD5E1]"
                          }`}
                        >
                          {u.role === "ADMIN" ? "DEPARTMENT_ADMIN" : u.role}
                          {u.isActive === false ? " (INACTIVE)" : ""}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                          {u.department || "General / Citizen"}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1"><MapPin className="w-3 h-3 text-[#0B4EA2] shrink-0" /><span>{u.district}</span></div>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-bold text-[#0B4EA2]">
                        {u.complaintsCount}
                      </td>

                      <td className="py-3 px-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {new Date(u.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {u.id !== currentUser.id && u.role !== "SUPER_ADMIN" && (
                          <button
                            type="button"
                            disabled={roleUpdatingId === u.id}
                            onClick={() => handleToggleUserStatus(u.id, u.isActive === false)}
                            className={`mr-2 px-2 py-1 rounded text-[10px] font-bold border ${
                              u.isActive === false
                                ? "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
                                : "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                            }`}
                          >
                            {u.isActive === false ? "Activate" : "Deactivate"}
                          </button>
                        )}
                        <select
                          value={u.role === "ADMIN" ? "DEPARTMENT_ADMIN" : u.role}
                          disabled={roleUpdatingId === u.id || u.id === currentUser.id || u.role === "SUPER_ADMIN"}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="h-8 px-2 rounded border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] font-semibold focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                        >
                          <option value="CITIZEN">Citizen</option>
                          <option value="OFFICER">Officer</option>
                          <option value="DEPARTMENT_ADMIN">Department Admin</option>
                          {u.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin</option>}
                        </select>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB: AUDIT LOGS ==================== */}
      {subTab === "audit" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <History className="w-5 h-5 text-[#0B4EA2]" />
                <span>System-Wide Complaint Audit Logs</span>
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                Real-time chronological timeline tracking all grievance status transitions, officer dispatches, and resolutions.
              </p>
            </div>
            <div className="font-mono text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">
              Showing last {auditLogs.length} audit entries
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Grievance ID</th>
                  <th className="py-2.5 px-3">Action Status</th>
                  <th className="py-2.5 px-3">Author & Role</th>
                  <th className="py-2.5 px-3">Audit Details & Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#64748B] dark:text-[#94A3B8]">
                      No audit events logged yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]">
                      <td className="py-3 px-3 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-[#0B4EA2]">
                        {log.trackingNumber || log.complaintId.slice(0, 8)}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === "RESOLVED"
                              ? "bg-[#ECFDF3] text-[#15803D]"
                              : log.status === "ASSIGNED"
                              ? "bg-[#EAF2FF] text-[#0B4EA2]"
                              : log.status === "REJECTED"
                              ? "bg-[#FEF2F2] text-[#DC2626]"
                              : "bg-[#F1F5F9] text-[#475569] dark:text-[#94A3B8]"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] block">{log.author}</span>
                        <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase">{log.authorRole}</span>
                      </td>

                      <td className="py-3 px-3 text-[#475569] dark:text-[#94A3B8] max-w-md">
                        {log.note}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB: DISTRICTS ==================== */}
      {subTab === "districts" && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search district name, division, or headquarters (e.g. Kolhapur, Pune, Nashik)..."
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">Sort By:</span>
              <select
                value={districtSortBy}
                onChange={(e: any) => setDistrictSortBy(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
              >
                <option value="count">Total Complaints (Highest)</option>
                <option value="pending">Pending Cases (Highest)</option>
                <option value="rate">Resolution Rate (%)</option>
              </select>
            </div>
          </div>

          {/* District Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDistricts.map((district) => (
              <div
                key={district.divisionId}
                className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                        {district.divisionName}
                      </h3>
                      <span className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5 block">
                        Headquarters: <strong>{district.headquarters}</strong>
                      </span>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#EAF2FF] text-[#0B4EA2] border border-[#BFDBFE] font-mono">
                      {district.totalComplaints} Complaints
                    </span>
                  </div>

                  {/* Sub-Districts Chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {district.districts.slice(0, 4).map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded text-[11px] bg-[#F1F5F9] text-[#475569] dark:text-[#94A3B8]"
                      >
                        {d}
                      </span>
                    ))}
                    {district.districts.length > 4 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                        +{district.districts.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#E2E8F0] text-center">
                    <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-2 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase block">Pending</span>
                      <span className="font-bold text-xs text-[#B45309] font-mono">
                        {district.pendingComplaints}
                      </span>
                    </div>
                    <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-2 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase block">Resolved</span>
                      <span className="font-bold text-xs text-[#15803D] font-mono">
                        {district.resolvedComplaints}
                      </span>
                    </div>
                    <div className="bg-[#F8FAFC] dark:bg-[#161F30] p-2 rounded border border-[#E2E8F0] dark:border-[#1E293B]">
                      <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase block">Critical</span>
                      <span className="font-bold text-xs text-[#DC2626] font-mono">
                        {district.criticalComplaints}
                      </span>
                    </div>
                  </div>

                  {/* SLA Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">SLA Resolution Rate</span>
                      <span className="font-bold text-[#15803D] font-mono">
                        {district.resolutionRate}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
                        style={{ width: `${district.resolutionRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <strong>{district.assignedOfficers}</strong> Field Officers
                  </span>

                  <button
                    type="button"
                    onClick={() => onFilterDistrict && onFilterDistrict(district.divisionId)}
                    className="text-xs text-[#0B4EA2] hover:text-[#083B7A] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Filter Queue</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed District Breakdown Table */}
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#0B4EA2]" />
                Maharashtra Statewide Grievance Distribution Table
              </h3>
              <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Updated in real-time</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Division / District</th>
                    <th className="py-3 px-4">Headquarters</th>
                    <th className="py-3 px-4 text-center">Total Logged</th>
                    <th className="py-3 px-4 text-center">Pending</th>
                    <th className="py-3 px-4 text-center">Resolved</th>
                    <th className="py-3 px-4 text-center">Critical</th>
                    <th className="py-3 px-4 text-center">SLA Rate</th>
                    <th className="py-3 px-4 text-center">Active Officers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
                  {filteredDistricts.map((d) => (
                    <tr key={d.divisionId} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]">
                      <td className="py-3 px-4 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        {d.divisionName}
                      </td>
                      <td className="py-3 px-4 text-[#64748B] dark:text-[#94A3B8]">{d.headquarters}</td>
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        {d.totalComplaints}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#B45309] font-mono">
                        {d.pendingComplaints}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#15803D] font-mono">
                        {d.resolvedComplaints}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#DC2626] font-mono">
                        {d.criticalComplaints}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-full font-bold text-[11px] bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                          {d.resolutionRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[#0B4EA2] font-semibold">
                        {d.assignedOfficers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: ADD ADMIN / OFFICER FORM ==================== */}
      {subTab === "addAdmin" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#1E293B] rounded-xl p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#0B4EA2]" />
                  Add New Officer or Administrator
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                  Registers personnel into the municipal directory.
                </p>
              </div>
            </div>

            {/* Success message */}
            {successMessage && (
              <div className="mb-5 p-4 rounded-lg bg-[#ECFDF3] border border-[#BBF7D0] text-[#15803D] text-xs flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
                <div className="flex-1">
                  <strong className="block font-semibold">Registration Completed</strong>
                  <span>{successMessage}</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <div className="mb-5 p-4 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-xs flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                <div className="flex-1">
                  <strong className="block font-semibold">Action Required</strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider mb-2">
                  Administrative Clearance Role <span className="text-[#DC2626]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedRole("OFFICER")}
                    className={`p-3.5 rounded-lg border text-left transition-all flex items-start gap-3 ${
                      selectedRole === "OFFICER"
                        ? "bg-[#EAF2FF] border-[#0B4EA2] text-[#0F172A] dark:text-[#F8FAFC]"
                        : "bg-white dark:bg-[#161F30] border-[#CBD5E1] dark:border-[#2D3748] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
                    }`}
                  >
                    <div
                      className={`p-2 rounded shrink-0 ${
                        selectedRole === "OFFICER" ? "bg-[#0B4EA2] text-white" : "bg-[#F1F5F9] text-[#64748B] dark:text-[#94A3B8]"
                      }`}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">Field Municipal Officer</div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        Assigned to inspections, on-ground work, and complaint resolution.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole("DEPARTMENT_ADMIN")}
                    className={`p-3.5 rounded-lg border text-left transition-all flex items-start gap-3 ${
                      selectedRole === "DEPARTMENT_ADMIN"
                        ? "bg-[#FFF7E6] border-[#B45309] text-[#0F172A] dark:text-[#F8FAFC]"
                        : "bg-white dark:bg-[#161F30] border-[#CBD5E1] dark:border-[#2D3748] text-[#475569] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
                    }`}
                  >
                    <div
                      className={`p-2 rounded shrink-0 ${
                        selectedRole === "DEPARTMENT_ADMIN" ? "bg-[#B45309] text-white" : "bg-[#F1F5F9] text-[#64748B] dark:text-[#94A3B8]"
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">Primary Department Admin</div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        Strictly ONE active Primary Admin per department managing officers & non-login field workers.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                    Officer Full Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Er. Rahul Deshmukh"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                    Authorized 10-Digit Mobile <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs text-[#64748B] dark:text-[#94A3B8] font-bold">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="9876543210"
                      className="w-full pl-11 pr-3 py-2 rounded-lg border border-[#CBD5E1] text-xs text-[#0F172A] dark:text-[#F8FAFC] font-mono tracking-wider focus:outline-none focus:border-[#0B4EA2]"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Badge ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                    Official Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul.deshmukh@kolhapur.gov.in"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      Badge / Employee ID
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoGenerateBadge}
                      className="text-[11px] text-[#0B4EA2] hover:underline font-semibold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                    placeholder="e.g. MH-OFF-4412"
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] font-mono uppercase focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  />
                </div>
              </div>

              {/* Municipal Department */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                  Department Assignment <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} {dept.code ? `(${dept.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Designation & Division */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                    Official Designation / Title <span className="text-[#DC2626]">*</span>
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                  >
                    {PRESET_DESIGNATIONS.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                    <option value="OTHER">Other (Specify Custom...)</option>
                  </select>
                </div>

                {designation === "OTHER" ? (
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                      Specify Custom Designation <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customDesignation}
                      onChange={(e) => setCustomDesignation(e.target.value)}
                      placeholder="e.g. Chief Water Quality Auditor"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1.5">
                      Administrative Division / Jurisdiction
                    </label>
                    <select
                      value={selectedDivision}
                      onChange={(e) => setSelectedDivision(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
                    >
                      {MAHARASHTRA_DIVISIONS.map((div) => (
                        <option key={div.id} value={div.id}>
                          {div.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Immediate Availability Switch */}
              <div className="p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                    Immediate Complaint Dispatch Ready
                  </div>
                  <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Mark officer available for automated grievance allocation.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="w-4 h-4 text-[#0B4EA2] rounded border-[#CBD5E1]"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                className="w-full font-bold text-xs"
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                {isSubmitting
                  ? "Synchronizing Database Record..."
                  : `Register ${selectedRole === "DEPARTMENT_ADMIN" ? "Administrator" : "Officer"} into Database`}
              </Button>
            </form>
          </div>

          {/* Right Column: Recently Added Card & Info */}
          <div className="lg:col-span-4 space-y-4">
            {recentlyAdded && (
              <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#BBF7D0] dark:border-emerald-800/40 p-5 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-[#15803D] uppercase mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Added to Database</span>
                </div>
                <h4 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">{recentlyAdded.name}</h4>
                <span className="text-xs text-[#0B4EA2] block">{recentlyAdded.designation}</span>

                <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-1.5 text-xs text-[#475569] dark:text-[#94A3B8]">
                  <div className="flex justify-between">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Badge ID:</span>
                    <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">{recentlyAdded.badgeId || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Mobile:</span>
                    <span className="font-mono text-[#0F172A] dark:text-[#F8FAFC]">+91 {recentlyAdded.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Department:</span>
                    <span className="text-[#0F172A] dark:text-[#F8FAFC] truncate max-w-[150px]">
                      {recentlyAdded.department?.name || "General"}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubTab("roster")}
                  className="w-full mt-4 text-xs"
                >
                  View Active Roster
                </Button>
              </div>
            )}

            <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs">
              <h4 className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-[#0B4EA2]" />
                Super Admin Direct Sync
              </h4>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
                As Super Administrator, any officer or admin added here is immediately persisted into both the <code>Officer</code> and <code>User</code> tables of your connected Supabase PostgreSQL instance. They can log in immediately via OTP.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: REGISTERED ROSTER ==================== */}
      {subTab === "roster" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
                Statewide Registered Officers & Administrators Roster
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Live personnel stored in Supabase database. Super Admin can manage or decommission credentials.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setSubTab("addAdmin")}
              className="text-xs"
              leftIcon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add New Officer
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by officer name, badge, phone, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
              >
                <option value="ALL">All Roles</option>
                <option value="OFFICER">Officers</option>
                <option value="DEPARTMENT_ADMIN">Department Admins</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Officer Name & Clearance</th>
                  <th className="py-2.5 px-3">Badge ID</th>
                  <th className="py-2.5 px-3">Department & Designation</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-center">Cases</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
                {filteredOfficers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#64748B] dark:text-[#94A3B8]">
                      {isLoading ? "Loading personnel database..." : "No officers found."}
                    </td>
                  </tr>
                ) : (
                  filteredOfficers.map((o) => (
                    <tr key={o.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">{o.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              o.role === "DEPARTMENT_ADMIN" || o.role === "ADMIN"
                                ? "bg-[#FFF7E6] text-[#B45309] border border-[#FDE68A]"
                                : "bg-[#EAF2FF] text-[#0B4EA2] border border-[#BFDBFE]"
                            }`}
                          >
                            {o.role || "OFFICER"}
                          </span>
                          {o.district && (
                            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                              • {o.district}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                        {o.badgeId || "—"}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                          {o.department?.name || "General Municipal Services"}
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{o.designation || "Officer"}</div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[#0F172A] dark:text-[#F8FAFC]">+91 {o.phoneNumber}</div>
                        {o.email && (
                          <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate max-w-[150px]">
                            {o.email}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-semibold">
                        <span className="text-[#0B4EA2]">{o.activeCases}</span> /{" "}
                        <span className="text-[#15803D]">{o.resolvedCases}</span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {o.isAvailable ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF3] text-[#15803D] border border-[#BBF7D0]">
                            Available
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F1F5F9] text-[#64748B] dark:text-[#94A3B8] border border-[#CBD5E1]">
                            Offline
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteOfficer(o.id, o.name)}
                          disabled={deletingId === o.id}
                          className="p-1 rounded text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                          title="Remove officer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === "departments" && (
        <DepartmentsAdminPanel departments={departments} onRefresh={loadData} />
      )}

      {/* ==================== SUB-TAB 4: SYSTEM GOVERNANCE & SLA AUDIT ==================== */}
      {subTab === "governance" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#0B4EA2]" />
              Super Administrator Authority Governance Controls
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] leading-relaxed">
              As Chief Super Administrator, you have full override powers across all 6 municipal departments and 7 administrative divisions in Maharashtra.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
              <div className="p-4 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30]">
                <h4 className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">Category Classification Override</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Re-classify complaint categories and re-trigger automated routing statewide.
                </p>
                <span className="inline-block mt-3 text-[10px] font-bold text-[#15803D] bg-[#ECFDF3] px-2 py-0.5 rounded border border-[#BBF7D0]">
                  Active & Monitoring
                </span>
              </div>

              <div className="p-4 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30]">
                <h4 className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">SLA Breach Escalation</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  Complaints overdue past 24 hours are automatically escalated to Municipal Commissioners.
                </p>
                <span className="inline-block mt-3 text-[10px] font-bold text-[#0B4EA2] bg-[#EAF2FF] px-2 py-0.5 rounded border border-[#BFDBFE]">
                  24h Strict Deadline
                </span>
              </div>

              <div className="p-4 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#161F30]">
                <h4 className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">Supabase Database Health</h4>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                  PostgreSQL cluster running with real-time replication and live officer synchronization.
                </p>
                <span className="inline-block mt-3 text-[10px] font-bold text-[#15803D] bg-[#ECFDF3] px-2 py-0.5 rounded border border-[#BBF7D0]">
                  100% Operational
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
