"use client";

import React, { useState } from "react";
import {
  Building2,
  Plus,
  UserCog,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DepartmentItem,
  createDepartmentApi,
  updateDepartmentApi,
  assignOrReplaceDepartmentAdminApi,
} from "@/lib/api/admin";

interface DepartmentsAdminPanelProps {
  departments: DepartmentItem[];
  onRefresh: () => Promise<void> | void;
}

export function DepartmentsAdminPanel({ departments, onRefresh }: DepartmentsAdminPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [newDeptPhone, setNewDeptPhone] = useState("");
  const [newDeptEmail, setNewDeptEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingAdminDept, setEditingAdminDept] = useState<DepartmentItem | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminDesignation, setAdminDesignation] = useState("Department Head / Executive Engineer");
  const [isAssigningAdmin, setIsAssigningAdmin] = useState(false);
  const [togglingDeptId, setTogglingDeptId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openAssignAdmin = (dept: DepartmentItem) => {
    setFeedback(null);
    setEditingAdminDept(dept);
    setAdminName("");
    setAdminPhone("");
    setAdminEmail("");
    setAdminDesignation("Department Head");
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!newDeptName.trim()) {
      setFeedback({ type: "error", text: "Department name is required." });
      return;
    }

    setIsCreating(true);
    try {
      await createDepartmentApi({
        name: newDeptName.trim(),
        code: newDeptCode.trim() || undefined,
        description: newDeptDesc.trim() || undefined,
        contactPhone: newDeptPhone.trim() || undefined,
        contactEmail: newDeptEmail.trim() || undefined,
      });
      setFeedback({ type: "success", text: `Department "${newDeptName.trim()}" created successfully.` });
      setNewDeptName("");
      setNewDeptCode("");
      setNewDeptDesc("");
      setNewDeptPhone("");
      setNewDeptEmail("");
      setShowCreateForm(false);
      await onRefresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to create department." });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleDepartmentStatus = async (dept: DepartmentItem) => {
    setFeedback(null);
    setTogglingDeptId(dept.id);
    const nextStatus = dept.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
    try {
      await updateDepartmentApi(dept.id, { status: nextStatus });
      setFeedback({
        type: "success",
        text: `${dept.name} marked as ${nextStatus}.`,
      });
      await onRefresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update department status." });
    } finally {
      setTogglingDeptId(null);
    }
  };

  const handleAssignOrReplaceAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminDept) return;
    setFeedback(null);

    const cleanPhone = adminPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setFeedback({ type: "error", text: "Enter a valid 10-digit Indian mobile number." });
      return;
    }
    if (adminName.trim().length < 2) {
      setFeedback({ type: "error", text: "Provide full name for the Department Admin." });
      return;
    }

    setIsAssigningAdmin(true);
    try {
      const hasExisting = Boolean(editingAdminDept.primaryAdmin);
      await assignOrReplaceDepartmentAdminApi(editingAdminDept.id, {
        name: adminName.trim(),
        phoneNumber: cleanPhone,
        email: adminEmail.trim() || undefined,
        designation: adminDesignation.trim() || "Department Head",
        replaceExisting: hasExisting,
      });
      setFeedback({
        type: "success",
        text: `${hasExisting ? "Replaced" : "Assigned"} Primary Department Admin for ${editingAdminDept.name}.`,
      });
      setEditingAdminDept(null);
      await onRefresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to assign Department Admin." });
    } finally {
      setIsAssigningAdmin(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0B4EA2]" />
            <span>Municipal Departments & Single Primary Department Admin Governance</span>
          </h3>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
            Each municipal department has strictly ONE active Primary Department Admin responsible for department officers, field worker records, and SLA compliance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onRefresh()}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setShowCreateForm((v) => !v)}
            className="gap-1.5 text-xs bg-[#0B4EA2] hover:bg-[#083B7A] text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreateForm ? "Close Form" : "New Department"}</span>
          </Button>
        </div>
      </div>

      {/* Status Alert */}
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

      {/* Create Department Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateDepartment}
          className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4"
        >
          <h4 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
            Create Municipal Department
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Department Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g. Solid Waste Department"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Department Code
              </label>
              <input
                type="text"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                placeholder="e.g. SOLID_WASTE"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Helpline Phone
              </label>
              <input
                type="tel"
                value={newDeptPhone}
                onChange={(e) => setNewDeptPhone(e.target.value)}
                placeholder="e.g. 0231-2651001"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Official Email
              </label>
              <input
                type="email"
                value={newDeptEmail}
                onChange={(e) => setNewDeptEmail(e.target.value)}
                placeholder="dept@kmc.gov.in"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Scope & Jurisdiction Description
              </label>
              <input
                type="text"
                value={newDeptDesc}
                onChange={(e) => setNewDeptDesc(e.target.value)}
                placeholder="Statutory civic functions handled by this department"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating} className="bg-[#0B4EA2] text-white">
              Create Department
            </Button>
          </div>
        </form>
      )}

      {/* Assign / Replace Primary Admin Modal-Inline Panel */}
      {editingAdminDept && (
        <form
          onSubmit={handleAssignOrReplaceAdmin}
          className="bg-[#FFFBEB] dark:bg-[#1E293B] rounded-xl border border-[#FCD34D] dark:border-[#92400E] p-5 shadow-2xs space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-[#92400E] dark:text-[#FCD34D] flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                <span>
                  {editingAdminDept.primaryAdmin ? "Replace Primary Department Admin" : "Assign Primary Department Admin"} — {editingAdminDept.name}
                </span>
              </h4>
              <p className="text-xs text-[#78350F] dark:text-[#FDE68A] mt-0.5">
                {editingAdminDept.primaryAdmin
                  ? `Replacing "${editingAdminDept.primaryAdmin.name || editingAdminDept.primaryAdmin.phoneNumber}" atomically deactivates their admin access and promotes the new primary admin.`
                  : "Enforces PostgreSQL unique constraint: exactly 1 active primary Department Admin per department."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingAdminDept(null)}
              className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Full Name <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Rajeshwari Kulkarni"
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
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="9822011101"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Designation
              </label>
              <input
                type="text"
                value={adminDesignation}
                onChange={(e) => setAdminDesignation(e.target.value)}
                placeholder="Department Head"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@kmc.gov.in"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingAdminDept(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAssigningAdmin}
              className="bg-[#B45309] hover:bg-[#92400E] text-white"
            >
              {editingAdminDept.primaryAdmin ? "Confirm Atomic Replace" : "Assign Primary Admin"}
            </Button>
          </div>
        </form>
      )}

      {/* Department Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => {
          const isInactive = dept.status === "INACTIVE";
          return (
            <div
              key={dept.id}
              className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF2FF] dark:bg-[#1E3A8A]/40 text-[#0B4EA2] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1D4ED8]/40">
                      {dept.code || "DEPT"}
                    </span>
                    <h4 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] mt-1.5">
                      {dept.name}
                    </h4>
                  </div>

                  <button
                    type="button"
                    disabled={togglingDeptId === dept.id}
                    onClick={() => handleToggleDepartmentStatus(dept)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                      isInactive
                        ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                        : "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
                    }`}
                  >
                    {dept.status || "ACTIVE"}
                  </button>
                </div>

                {dept.description && (
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2">
                    {dept.description}
                  </p>
                )}

                {/* Counts */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="p-2 rounded bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">Complaints</span>
                    <span className="font-mono font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                      {dept._count?.complaints ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">Officers</span>
                    <span className="font-mono font-bold text-xs text-[#0B4EA2] dark:text-[#60A5FA]">
                      {dept._count?.officers ?? 0}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B]">
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">Workers</span>
                    <span className="font-mono font-bold text-xs text-[#15803D]">
                      {dept._count?.fieldWorkers ?? 0}
                    </span>
                  </div>
                </div>

                {/* Primary Admin Box */}
                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0B4EA2]" />
                      Primary Department Admin
                    </span>
                    {dept.primaryAdmin ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          dept.primaryAdmin.isActive
                            ? "bg-[#ECFDF3] text-[#15803D]"
                            : "bg-[#FEF2F2] text-[#DC2626]"
                        }`}
                      >
                        {dept.primaryAdmin.isActive ? "Active" : "Inactive"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFF7E6] text-[#B45309]">
                        Unassigned
                      </span>
                    )}
                  </div>

                  {dept.primaryAdmin ? (
                    <div className="space-y-0.5 text-xs">
                      <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        {dept.primaryAdmin.name || "Assigned Admin"}
                      </div>
                      {dept.primaryAdmin.designation && (
                        <div className="text-[11px] text-[#475569] dark:text-[#94A3B8] flex items-center gap-1">
                          <Briefcase className="w-3 h-3 shrink-0" />
                          <span>{dept.primaryAdmin.designation}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>+91 {dept.primaryAdmin.phoneNumber}</span>
                      </div>
                      {dept.primaryAdmin.email && (
                        <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{dept.primaryAdmin.email}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      No active Department Admin assigned yet.
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openAssignAdmin(dept)}
                className="w-full text-xs gap-1.5"
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>{dept.primaryAdmin ? "Replace Primary Admin" : "Assign Primary Admin"}</span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
