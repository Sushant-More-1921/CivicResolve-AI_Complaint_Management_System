"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Building2,
  Users,
  HardHat,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Phone,
  ShieldAlert,
  Briefcase,
  Trash2,
  Power,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthUser } from "@/types/auth";
import { MasterIncident } from "@/types/incident";
import {
  OfficerItem,
  fetchOfficersApi,
  addOfficerApi,
  updateOfficerApi,
  deleteOfficerApi,
  fetchFieldWorkersApi,
} from "@/lib/api/admin";
import { FieldWorkerManager } from "@/components/common/field-worker-manager";
import type { FieldWorkerRecord } from "@/lib/api/officer-portal";

interface DepartmentAdminViewProps {
  currentUser: AuthUser;
  incidents: MasterIncident[];
  onRefreshDashboard?: () => Promise<void> | void;
}

export function DepartmentAdminView({
  currentUser,
  incidents,
  onRefreshDashboard,
}: DepartmentAdminViewProps) {
  const [subTab, setSubTab] = useState<"officers" | "workers">("officers");
  const [officers, setOfficers] = useState<OfficerItem[]>([]);
  const [workers, setWorkers] = useState<FieldWorkerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Officer Form State
  const [offName, setOffName] = useState("");
  const [offPhone, setOffPhone] = useState("");
  const [offEmail, setOffEmail] = useState("");
  const [offDesignation, setOffDesignation] = useState("Junior Engineer");
  const [offSubmitting, setOffSubmitting] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDepartmentDirectory = useCallback(async () => {
    setIsLoading(true);
    try {
      const [officerList, workerList] = await Promise.all([
        fetchOfficersApi(
          currentUser.departmentId ? { departmentId: currentUser.departmentId } : undefined
        ),
        fetchFieldWorkersApi(currentUser.departmentId || undefined),
      ]);
      setOfficers(officerList);
      setWorkers(workerList);
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to load department directory." });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.departmentId]);

  useEffect(() => {
    loadDepartmentDirectory();
  }, [loadDepartmentDirectory]);

  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const cleanPhone = offPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setFeedback({ type: "error", text: "Enter a valid 10-digit mobile number for the officer." });
      return;
    }
    if (offName.trim().length < 2) {
      setFeedback({ type: "error", text: "Enter officer full name (min 2 chars)." });
      return;
    }

    setOffSubmitting(true);
    try {
      await addOfficerApi({
        name: offName.trim(),
        phoneNumber: cleanPhone,
        email: offEmail.trim() || undefined,
        designation: offDesignation.trim() || "Field Officer",
        departmentId: currentUser.departmentId || undefined,
        role: "OFFICER",
        isAvailable: true,
      });
      setFeedback({
        type: "success",
        text: `Officer ${offName.trim()} added to ${currentUser.departmentName || "your department"}.`,
      });
      setOffName("");
      setOffPhone("");
      setOffEmail("");
      await loadDepartmentDirectory();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to register officer." });
    } finally {
      setOffSubmitting(false);
    }
  };

  const handleToggleOfficerAvailability = async (officer: OfficerItem) => {
    setBusyId(officer.id);
    setFeedback(null);
    try {
      await updateOfficerApi(officer.id, { isAvailable: !officer.isAvailable });
      await loadDepartmentDirectory();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update availability." });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleOfficerAccountStatus = async (officer: OfficerItem) => {
    setBusyId(officer.id);
    setFeedback(null);
    const nextActive = (officer.user?.isActive ?? officer.isActive) === false;
    try {
      await updateOfficerApi(officer.id, { isActive: nextActive });
      setFeedback({
        type: "success",
        text: `Officer "${officer.name}" ${nextActive ? "activated" : "deactivated"}.`,
      });
      await loadDepartmentDirectory();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update officer status." });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveOfficer = async (officer: OfficerItem) => {
    if (!confirm(`Deactivate and remove "${officer.name}" from active duty?`)) return;
    setBusyId(officer.id);
    setFeedback(null);
    try {
      await deleteOfficerApi(officer.id);
      setFeedback({ type: "success", text: `Officer "${officer.name}" removed from active roster.` });
      await loadDepartmentDirectory();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to remove officer." });
    } finally {
      setBusyId(null);
    }
  };

  const deptName = currentUser.departmentName || "Assigned Department";

  return (
    <div className="space-y-6">
      {/* Department Admin Header Banner */}
      <div className="bg-linear-to-r from-[#0F172A] via-[#0B4EA2] to-[#1E3A8A] rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-white/15 rounded-xl border border-white/25">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-bold uppercase tracking-wider">
              Primary Department Admin
            </span>
            <h2 className="text-lg font-extrabold tracking-tight mt-1">{deptName}</h2>
            <p className="text-xs text-white/80">
              Scoped Access: You manage officers, field worker records, and complaints strictly for {deptName}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 shrink-0 text-center">
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Complaints</span>
            <span className="text-base font-mono font-bold">{incidents.length}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Officers</span>
            <span className="text-base font-mono font-bold">{officers.length}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Field Crew</span>
            <span className="text-base font-mono font-bold">{workers.length}</span>
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center justify-between border-b border-[#CBD5E1] dark:border-[#1E293B] pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab("officers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === "officers"
                ? "bg-[#0B4EA2] text-white shadow-xs"
                : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30]"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Department Officers ({officers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("workers")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === "workers"
                ? "bg-[#0B4EA2] text-white shadow-xs"
                : "text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#161F30]"
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>Field Workers Registry ({workers.length})</span>
          </button>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={loadDepartmentDirectory}
          className="text-xs gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-[#ECFDF3] border-[#BBF7D0] text-[#15803D]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="font-medium">{feedback.text}</span>
        </div>
      )}

      {/* TAB 1: OFFICERS */}
      {subTab === "officers" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Register Officer Form */}
          <form
            onSubmit={handleAddOfficer}
            className="lg:col-span-4 bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4 text-xs"
          >
            <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0B4EA2]" />
                <span>Register Department Officer</span>
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                Locked to {deptName}. Officers receive complaint assignments & manage field tasks.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Full Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                value={offName}
                onChange={(e) => setOffName(e.target.value)}
                placeholder="e.g. Er. Sneha Deshpande"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                10-Digit Mobile <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={offPhone}
                onChange={(e) => setOffPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9822011299"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Designation
              </label>
              <input
                type="text"
                value={offDesignation}
                onChange={(e) => setOffDesignation(e.target.value)}
                placeholder="Junior Engineer / Sanitary Inspector"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={offEmail}
                onChange={(e) => setOffEmail(e.target.value)}
                placeholder="officer@kmc.gov.in"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={offSubmitting}
              className="w-full bg-[#0B4EA2] hover:bg-[#083B7A] text-white"
            >
              Add Officer to Department
            </Button>
          </form>

          {/* Officers List */}
          <div className="lg:col-span-8 bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
              Active Department Officers Roster
            </h3>

            <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase">
                    <th className="py-2.5 px-3">Officer</th>
                    <th className="py-2.5 px-3">Badge & Phone</th>
                    <th className="py-2.5 px-3 text-center">Workload</th>
                    <th className="py-2.5 px-3 text-center">Duty Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
                  {officers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748B]">
                        {isLoading ? "Loading officers..." : "No officers registered in this department yet."}
                      </td>
                    </tr>
                  ) : (
                    officers.map((o) => {
                      const accountActive = (o.user?.isActive ?? o.isActive) !== false;
                      return (
                        <tr key={o.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]">
                          <td className="py-3 px-3">
                            <div className="font-bold">{o.name}</div>
                            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                              {o.designation || "Field Officer"}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px]">
                            <div className="text-[#0B4EA2] dark:text-[#60A5FA] font-semibold">{o.badgeId}</div>
                            <div className="text-[#64748B] dark:text-[#94A3B8]">+91 {o.phoneNumber}</div>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold">
                            {o._count?.complaints ?? o.activeCases ?? 0}
                          </td>
                          <td className="py-3 px-3 text-center space-x-1">
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => handleToggleOfficerAvailability(o)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                o.isAvailable
                                  ? "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
                                  : "bg-[#FFF7E6] text-[#B45309] border-[#FDE68A]"
                              }`}
                            >
                              {o.isAvailable ? "Available" : "Busy"}
                            </button>
                            {!accountActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
                                Disabled
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => handleToggleOfficerAccountStatus(o)}
                              title={accountActive ? "Deactivate login access" : "Activate login access"}
                              className="p-1.5 rounded border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]"
                            >
                              <Power className={`w-3.5 h-3.5 ${accountActive ? "text-[#15803D]" : "text-[#DC2626]"}`} />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === o.id}
                              onClick={() => handleRemoveOfficer(o)}
                              title="Remove officer"
                              className="p-1.5 rounded border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NON-LOGIN FIELD WORKERS REGISTRY */}
      {subTab === "workers" && (
        <FieldWorkerManager
          departmentId={currentUser.departmentId}
          departmentName={deptName}
          workers={workers}
          isLoading={isLoading}
          onReload={loadDepartmentDirectory}
        />
      )}
    </div>
  );
}
