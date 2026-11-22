"use client";

import React, { useState } from "react";
import {
  HardHat,
  CheckCircle2,
  AlertTriangle,
  Phone,
  ShieldAlert,
  Briefcase,
  Trash2,
  Pencil,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createFieldWorkerApi,
  updateFieldWorkerApi,
  deleteFieldWorkerApi,
} from "@/lib/api/admin";
import type { FieldWorkerRecord } from "@/lib/api/officer-portal";

interface FieldWorkerManagerProps {
  departmentId?: string | null;
  departmentName: string;
  workers: FieldWorkerRecord[];
  isLoading?: boolean;
  onReload: () => Promise<void> | void;
}

export function FieldWorkerManager({
  departmentId,
  departmentName,
  workers,
  isLoading = false,
  onReload,
}: FieldWorkerManagerProps) {
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("Field Technician");
  const [skills, setSkills] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState("AVAILABLE");
  const [status, setStatus] = useState("ACTIVE");

  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const resetForm = () => {
    setEditingWorkerId(null);
    setName("");
    setPhone("");
    setDesignation("Field Technician");
    setSkills("");
    setAvailabilityStatus("AVAILABLE");
    setStatus("ACTIVE");
  };

  const startEdit = (worker: FieldWorkerRecord) => {
    setFeedback(null);
    setEditingWorkerId(worker.id);
    setName(worker.name || "");
    setPhone(worker.phone || "");
    setDesignation(worker.designation || "Field Technician");
    setSkills(worker.skills || "");
    setAvailabilityStatus(worker.availabilityStatus || "AVAILABLE");
    setStatus(worker.status || "ACTIVE");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (name.trim().length < 2) {
      setFeedback({ type: "error", text: "Field worker name must be at least 2 characters." });
      return;
    }

    setSubmitting(true);
    try {
      if (editingWorkerId) {
        await updateFieldWorkerApi(editingWorkerId, {
          name: name.trim(),
          phone: phone.trim(),
          designation: designation.trim() || "Field Technician",
          skills: skills.trim(),
          availabilityStatus,
          status,
        });
        setFeedback({ type: "success", text: `Updated details for "${name.trim()}".` });
      } else {
        await createFieldWorkerApi({
          name: name.trim(),
          phone: phone.trim() || undefined,
          designation: designation.trim() || "Field Technician",
          skills: skills.trim() || undefined,
          departmentId: departmentId || undefined,
          availabilityStatus,
        });
        setFeedback({ type: "success", text: `Field worker "${name.trim()}" added to ${departmentName}.` });
      }
      resetForm();
      await onReload();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || `Failed to ${editingWorkerId ? "update" : "create"} field worker record.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (worker: FieldWorkerRecord) => {
    setBusyId(worker.id);
    setFeedback(null);
    const nextStatus = worker.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateFieldWorkerApi(worker.id, { status: nextStatus });
      setFeedback({ type: "success", text: `${worker.name} marked as ${nextStatus}.` });
      if (editingWorkerId === worker.id) setStatus(nextStatus);
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update worker status." });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (worker: FieldWorkerRecord) => {
    if (!confirm(`Remove field worker record "${worker.name}"?`)) return;
    setBusyId(worker.id);
    setFeedback(null);
    try {
      await deleteFieldWorkerApi(worker.id);
      if (editingWorkerId === worker.id) resetForm();
      setFeedback({ type: "success", text: `Field worker "${worker.name}" removed.` });
      await onReload();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to remove field worker record." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-[#ECFDF3] dark:bg-emerald-950/40 border-[#BBF7D0] dark:border-emerald-800 text-[#15803D] dark:text-emerald-300"
              : "bg-[#FEF2F2] dark:bg-red-950/40 border-[#FECACA] dark:border-red-800 text-[#DC2626] dark:text-red-300"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-4 bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4 text-xs"
        >
          <div className="border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
              <HardHat className="w-4 h-4 text-[#0B4EA2]" />
              <span>{editingWorkerId ? "Update Field Worker Details" : "Add Field Worker"}</span>
            </h3>
            {editingWorkerId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-semibold text-[#64748B] hover:text-[#0F172A] dark:hover:text-white inline-flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              Worker Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ramesh Kamble"
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              Contact Phone (Record Only)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9822099001"
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC] font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              Trade / Designation
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Pipeline Fitter / Sanitation Crew"
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              Skills & Equipment Certified
            </label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. Cold-mix asphalt, JCB signaling"
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                Availability
              </label>
              <select
                value={availabilityStatus}
                onChange={(e) => setAvailabilityStatus(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="ON_TASK">ON_TASK</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
              </select>
            </div>
            {editingWorkerId && (
              <div>
                <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                  Record Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={submitting}
            className="w-full bg-[#0B4EA2] hover:bg-[#083B7A] text-white"
          >
            {editingWorkerId ? "Save Worker Changes" : "Add Field Worker"}
          </Button>
        </form>

        <div className="lg:col-span-8 bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC]">
              Department Field Crew Roster ({departmentName})
            </h3>
            <span className="text-[11px] font-mono font-semibold text-[#64748B] dark:text-[#94A3B8]">
              {workers.length} record{workers.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#64748B] dark:text-[#94A3B8] font-semibold uppercase">
                  <th className="py-2.5 px-3">Worker & Skills</th>
                  <th className="py-2.5 px-3">Trade</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-center">Availability</th>
                  <th className="py-2.5 px-3 text-center">Tasks</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC]">
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#64748B]">
                      {isLoading ? "Loading field workers..." : "No field workers added yet."}
                    </td>
                  </tr>
                ) : (
                  workers.map((w) => (
                    <tr
                      key={w.id}
                      className={`hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] ${
                        editingWorkerId === w.id ? "bg-[#EFF6FF] dark:bg-[#1E293B]/60" : ""
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold">{w.name}</div>
                        {w.skills && (
                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 mt-0.5">
                            <Wrench className="w-3 h-3 shrink-0" />
                            <span>{w.skills}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#475569] dark:text-[#94A3B8]">
                          <Briefcase className="w-3 h-3 shrink-0" />
                          {w.designation}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        {w.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {w.phone}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[10px] font-semibold">
                          {w.availabilityStatus || "AVAILABLE"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-[#0B4EA2] dark:text-[#60A5FA]">
                        {w._count?.taskAssignments ?? 0}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={busyId === w.id}
                          onClick={() => handleToggleStatus(w)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            w.status === "ACTIVE"
                              ? "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]"
                              : "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                          }`}
                        >
                          {w.status}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => startEdit(w)}
                            title="Update field worker details"
                            className="p-1.5 rounded border border-[#CBD5E1] dark:border-[#334155] text-[#0B4EA2] dark:text-[#60A5FA] hover:bg-[#EAF2FF] dark:hover:bg-[#1E293B]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === w.id}
                            onClick={() => handleDelete(w)}
                            title="Remove field worker record"
                            className="p-1.5 rounded border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

