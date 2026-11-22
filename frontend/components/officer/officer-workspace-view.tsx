"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  HardHat,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Plus,
  Clock,
  ShieldCheck,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/common/priority-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { AuthUser } from "@/types/auth";
import { getSessionToken } from "@/lib/auth/session";
import { updateComplaintStatusApi } from "@/lib/api/complaints";
import { fetchFieldWorkersApi } from "@/lib/api/admin";
import { FieldWorkerManager } from "@/components/common/field-worker-manager";
import {
  FieldTaskRecord,
  FieldWorkerRecord,
  EvidenceRecord,
  OfficerDashboardSummary,
  fetchOfficerDashboardApi,
  fetchOfficerComplaintsApi,
  fetchOfficerFieldWorkersApi,
  fetchOfficerTasksApi,
  createOfficerTaskApi,
  updateOfficerTaskApi,
  uploadComplaintEvidenceApi,
} from "@/lib/api/officer-portal";

interface OfficerWorkspaceViewProps {
  currentUser: AuthUser;
  onRefreshDashboard?: () => Promise<void> | void;
}

export function OfficerWorkspaceView({
  currentUser,
  onRefreshDashboard,
}: OfficerWorkspaceViewProps) {
  const [summary, setSummary] = useState<OfficerDashboardSummary | null>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [workers, setWorkers] = useState<FieldWorkerRecord[]>([]);
  const [allDeptWorkers, setAllDeptWorkers] = useState<FieldWorkerRecord[]>([]);
  const [tasks, setTasks] = useState<FieldTaskRecord[]>([]);
  const [workspaceTab, setWorkspaceTab] = useState<"execution" | "workers">("execution");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create Task state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInstructions, setTaskInstructions] = useState("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [creatingTask, setCreatingTask] = useState(false);

  // Evidence Upload state
  const [evidenceStage, setEvidenceStage] = useState<"BEFORE" | "IN_PROGRESS" | "AFTER">("BEFORE");
  const [evidenceCaption, setEvidenceCaption] = useState("");
  const [evidenceBase64, setEvidenceBase64] = useState<string>("");
  const [evidenceMime, setEvidenceMime] = useState<"image/jpeg" | "image/png" | "image/webp">("image/jpeg");
  const [evidencePreview, setEvidencePreview] = useState<string>("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Task Update state
  const [taskProgressEdits, setTaskProgressEdits] = useState<Record<string, string>>({});
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Resolution state
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [resolving, setResolving] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dash, compList, workerList, deptWorkersList, taskList] = await Promise.all([
        fetchOfficerDashboardApi(),
        fetchOfficerComplaintsApi(),
        fetchOfficerFieldWorkersApi(),
        fetchFieldWorkersApi(currentUser.departmentId || undefined),
        fetchOfficerTasksApi(),
      ]);
      setSummary(dash);
      setComplaints(compList);
      setWorkers(workerList);
      setAllDeptWorkers(deptWorkersList);
      setTasks(taskList);

      if (compList.length > 0 && !selectedComplaintId) {
        setSelectedComplaintId(compList[0].id);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to load officer workspace." });
    } finally {
      setIsLoading(false);
    }
  }, [selectedComplaintId, currentUser.departmentId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const selectedComplaint =
    complaints.find((c) => c.id === selectedComplaintId) || complaints[0] || null;

  const complaintTasks = selectedComplaint
    ? tasks.filter((t) => t.complaintId === selectedComplaint.id)
    : [];

  const complaintEvidence: EvidenceRecord[] = selectedComplaint?.evidence || [];
  const hasAfterEvidence = complaintEvidence.some((e) => e.stage === "AFTER");

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setFeedback(null);

    if (!taskTitle.trim()) {
      setFeedback({ type: "error", text: "Task title is required." });
      return;
    }

    setCreatingTask(true);
    try {
      await createOfficerTaskApi({
        complaintId: selectedComplaint.id,
        title: taskTitle.trim(),
        instructions: taskInstructions.trim() || undefined,
        workerIds: selectedWorkerIds,
      });
      setFeedback({
        type: "success",
        text: `Field task "${taskTitle.trim()}" created and crew dispatched.`,
      });
      setTaskTitle("");
      setTaskInstructions("");
      setSelectedWorkerIds([]);
      await loadWorkspace();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to create task." });
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTaskStatusUpdate = async (
    task: FieldTaskRecord,
    nextStatus: FieldTaskRecord["status"]
  ) => {
    setUpdatingTaskId(task.id);
    setFeedback(null);
    try {
      await updateOfficerTaskApi(task.id, {
        status: nextStatus,
        progressNote: taskProgressEdits[task.id]?.trim() || task.progressNote || undefined,
      });
      setFeedback({ type: "success", text: `Task "${task.title}" updated to ${nextStatus}.` });
      await loadWorkspace();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update task." });
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "error", text: "Image must be smaller than 5 MB." });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"] as const;
    const mime = (allowed.includes(file.type as any) ? file.type : "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp";
    setEvidenceMime(mime);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setEvidencePreview(dataUrl);
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      setEvidenceBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setFeedback(null);

    if (!evidenceBase64) {
      setFeedback({ type: "error", text: "Please select an image file to upload as evidence." });
      return;
    }

    setUploadingEvidence(true);
    try {
      await uploadComplaintEvidenceApi(selectedComplaint.id, {
        stage: evidenceStage,
        imageBase64: evidenceBase64,
        imageContentType: evidenceMime,
        caption: evidenceCaption.trim() || `${evidenceStage} inspection photo`,
      });
      setFeedback({
        type: "success",
        text: `${evidenceStage} photo evidence uploaded for ${selectedComplaint.trackingNumber}.`,
      });
      setEvidenceBase64("");
      setEvidencePreview("");
      setEvidenceCaption("");
      await loadWorkspace();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to upload evidence photo." });
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleComplaintStatus = async (newStatus: "IN_PROGRESS" | "RESOLVED") => {
    if (!selectedComplaint) return;
    setFeedback(null);
    const token = getSessionToken();
    if (!token) {
      setFeedback({ type: "error", text: "Session expired. Please sign in again." });
      return;
    }

    if (newStatus === "RESOLVED") {
      if (!hasAfterEvidence) {
        setFeedback({
          type: "error",
          text: "Upload at least one AFTER completion photo before resolving this complaint.",
        });
        return;
      }
      if (!resolveRemarks.trim()) {
        setFeedback({ type: "error", text: "Provide resolution remarks before closing." });
        return;
      }
    }

    setResolving(true);
    try {
      await updateComplaintStatusApi(
        selectedComplaint.id,
        newStatus,
        newStatus === "RESOLVED"
          ? { resolutionRemarks: resolveRemarks.trim() }
          : { resolutionRemarks: "Field inspection started by assigned officer." },
        token
      );
      setFeedback({
        type: "success",
        text: `Complaint ${selectedComplaint.trackingNumber} marked as ${newStatus}.`,
      });
      if (newStatus === "RESOLVED") setResolveRemarks("");
      await loadWorkspace();
      if (onRefreshDashboard) await onRefreshDashboard();
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update complaint status." });
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Officer Header Summary */}
      <div className="bg-linear-to-r from-[#0F172A] via-[#1E3A8A] to-[#0B4EA2] rounded-xl p-5 text-white shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-white/20 text-[10px] font-bold uppercase tracking-wider">
            Officer Field Execution Portal
          </span>
          <h2 className="text-lg font-extrabold tracking-tight mt-1">
            {currentUser.name || "Municipal Officer"} —{" "}
            {summary?.department?.name || currentUser.departmentName || "Assigned Department"}
          </h2>
          <p className="text-xs text-white/80">
            Strictly scoped to your assigned complaints, same-department Field Worker crews, and Before/After inspection evidence.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center shrink-0">
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Assigned</span>
            <span className="text-base font-mono font-bold">{summary?.assignedTotal ?? complaints.length}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">In Progress</span>
            <span className="text-base font-mono font-bold">{summary?.inProgress ?? 0}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Resolved</span>
            <span className="text-base font-mono font-bold">{summary?.resolved ?? 0}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Active Tasks</span>
            <span className="text-base font-mono font-bold">{summary?.activeTasks ?? tasks.length}</span>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-2">
            <span className="text-[10px] text-white/75 uppercase block">Dept Crew</span>
            <span className="text-base font-mono font-bold">{summary?.availableWorkers ?? workers.length}</span>
          </div>
        </div>
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

      {/* Sub-Tabs for Officer Operations & Field Worker CRUD */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
        <button
          type="button"
          onClick={() => setWorkspaceTab("execution")}
          className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors ${
            workspaceTab === "execution"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "bg-white dark:bg-[#111827] text-[#475569] dark:text-[#CBD5E1] border border-[#CBD5E1] dark:border-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]"
          }`}
        >
          <ClipboardCheck className="w-3.5 h-3.5" />
          <span>Assigned Complaints & Field Tasks ({complaints.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceTab("workers")}
          className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors ${
            workspaceTab === "workers"
              ? "bg-[#0B4EA2] text-white shadow-xs"
              : "bg-white dark:bg-[#111827] text-[#475569] dark:text-[#CBD5E1] border border-[#CBD5E1] dark:border-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#161F30]"
          }`}
        >
          <HardHat className="w-3.5 h-3.5" />
          <span>Manage Field Workers ({allDeptWorkers.length})</span>
        </button>
      </div>

      {workspaceTab === "workers" ? (
        <FieldWorkerManager
          departmentId={currentUser.departmentId}
          departmentName={summary?.department?.name || currentUser.departmentName || "Assigned Department"}
          workers={allDeptWorkers}
          isLoading={isLoading}
          onReload={loadWorkspace}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Assigned Complaints Queue */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
            <h3 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-[#0B4EA2]" />
              <span>Assigned Queue ({complaints.length})</span>
            </h3>
            <button
              type="button"
              onClick={loadWorkspace}
              className="text-xs font-semibold text-[#0B4EA2] dark:text-[#60A5FA] flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {complaints.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] py-8 text-center">
                {isLoading ? "Loading assigned complaints..." : "No complaints currently assigned to you."}
              </p>
            ) : (
              complaints.map((c) => {
                const isSelected = selectedComplaint?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedComplaintId(c.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all space-y-1.5 ${
                      isSelected
                        ? "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 border-[#0B4EA2] shadow-2xs"
                        : "bg-[#F8FAFC] dark:bg-[#161F30] border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#94A3B8]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-[#0B4EA2] dark:text-[#60A5FA]">
                        {c.trackingNumber}
                      </span>
                      <PriorityBadge priority={c.priority} size="sm" />
                    </div>
                    <div className="font-semibold text-xs text-[#0F172A] dark:text-[#F8FAFC] line-clamp-1">
                      {c.title}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      <span className="truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {c.location}
                      </span>
                      <StatusBadge status={c.status} size="sm" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Execution Details for Selected Complaint */}
        <div className="lg:col-span-8 space-y-5">
          {!selectedComplaint ? (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-10 text-center text-xs text-[#64748B]">
              Select an assigned complaint from the left queue to dispatch field workers and upload inspection photos.
            </div>
          ) : (
            <>
              {/* Selected Complaint Card */}
              <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-extrabold text-sm text-[#0B4EA2] dark:text-[#60A5FA]">
                        {selectedComplaint.trackingNumber}
                      </span>
                      <PriorityBadge priority={selectedComplaint.priority} size="sm" />
                      <StatusBadge status={selectedComplaint.status} size="sm" />
                    </div>
                    <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC] mt-1">
                      {selectedComplaint.title}
                    </h3>
                    <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1">
                      {selectedComplaint.description}
                    </p>
                  </div>

                  {selectedComplaint.status !== "IN_PROGRESS" &&
                    selectedComplaint.status !== "RESOLVED" && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={resolving}
                        onClick={() => handleComplaintStatus("IN_PROGRESS")}
                        className="shrink-0 text-xs gap-1.5 bg-[#0B4EA2] text-white"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Work</span>
                      </Button>
                    )}
                </div>

                {/* Create Task & Assign Non-Login Field Workers */}
                <form
                  onSubmit={handleCreateTask}
                  className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B] space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                      <HardHat className="w-4 h-4 text-[#0B4EA2]" />
                      <span>Create Operational Task & Assign Field Workers</span>
                    </h4>
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                      Same-department active crew only
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Task title (e.g. Clear storm drain & silt)"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
                    />
                    <input
                      type="text"
                      value={taskInstructions}
                      onChange={(e) => setTaskInstructions(e.target.value)}
                      placeholder="Equipment / safety instructions"
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]"
                    />
                  </div>

                  <div>
                    <span className="block font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5">
                      Assign Field Workers ({selectedWorkerIds.length} selected):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {workers.filter((w) => w.status === "ACTIVE").map((w) => {
                        const checked = selectedWorkerIds.includes(w.id);
                        return (
                          <label
                            key={w.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              checked
                                ? "bg-[#EAF2FF] dark:bg-[#1E3A8A]/40 border-[#0B4EA2]"
                                : "bg-white dark:bg-[#0F172A] border-[#CBD5E1] dark:border-[#334155]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWorkerSelection(w.id)}
                              className="rounded border-[#CBD5E1]"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                                {w.name}
                              </div>
                              <div className="text-[10px] text-[#64748B] truncate">
                                {w.designation}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={creatingTask}
                      className="gap-1.5 text-xs bg-[#0B4EA2] text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Dispatch Task & Crew</span>
                    </Button>
                  </div>
                </form>

                {/* Active Tasks List */}
                <div className="space-y-2.5">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Operational Tasks ({complaintTasks.length})</span>
                  </h4>
                  {complaintTasks.length === 0 ? (
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      No operational tasks logged for this complaint yet.
                    </p>
                  ) : (
                    complaintTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0F172A] space-y-2 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{t.title}</div>
                            {t.instructions && (
                              <div className="text-[11px] text-[#64748B]">{t.instructions}</div>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF2FF] text-[#0B4EA2] border border-[#BFDBFE] self-start">
                            {t.status}
                          </span>
                        </div>

                        {t.workers && t.workers.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {t.workers.map((tw) => (
                              <span
                                key={tw.id}
                                className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#1E293B] text-[10px] font-medium text-[#334155] dark:text-[#CBD5E1] inline-flex items-center gap-1"
                              >
                                <HardHat className="w-3 h-3 text-[#0B4EA2]" />
                                {tw.fieldWorker?.name} ({tw.fieldWorker?.designation})
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={taskProgressEdits[t.id] ?? t.progressNote ?? ""}
                            onChange={(e) =>
                              setTaskProgressEdits((prev) => ({ ...prev, [t.id]: e.target.value }))
                            }
                            placeholder="Field progress update note..."
                            className="flex-1 px-2.5 py-1.5 rounded border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#111827] text-xs"
                          />
                          <div className="flex items-center gap-1.5">
                            {t.status !== "IN_PROGRESS" && t.status !== "COMPLETED" && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                isLoading={updatingTaskId === t.id}
                                onClick={() => handleTaskStatusUpdate(t, "IN_PROGRESS")}
                                className="text-[11px] h-7"
                              >
                                Start
                              </Button>
                            )}
                            {t.status !== "COMPLETED" && (
                              <Button
                                type="button"
                                variant="success"
                                size="sm"
                                isLoading={updatingTaskId === t.id}
                                onClick={() => handleTaskStatusUpdate(t, "COMPLETED")}
                                className="text-[11px] h-7"
                              >
                                Complete Task
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Before / In-Progress / After Photo Evidence + Resolution */}
              <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] p-5 shadow-2xs space-y-4">
                <h4 className="font-bold text-sm text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#0B4EA2]" />
                  <span>Inspection Photo Evidence (Before / In-Progress / After)</span>
                </h4>

                <form
                  onSubmit={handleUploadEvidence}
                  className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#161F30] border border-[#E2E8F0] dark:border-[#1E293B] space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                        Inspection Stage
                      </label>
                      <select
                        value={evidenceStage}
                        onChange={(e) => setEvidenceStage(e.target.value as any)}
                        className="w-full px-2.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A]"
                      >
                        <option value="BEFORE">BEFORE (Pre-Work Site Photo)</option>
                        <option value="IN_PROGRESS">IN_PROGRESS (Work Underway)</option>
                        <option value="AFTER">AFTER (Completed Resolution Proof)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                        Caption / Location Detail
                      </label>
                      <input
                        type="text"
                        value={evidenceCaption}
                        onChange={(e) => setEvidenceCaption(e.target.value)}
                        placeholder="e.g. Culvert cleared and disinfected"
                        className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                        Upload Site Photo <span className="text-[#DC2626]">*</span>
                      </label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFilePick}
                        className="w-full text-[11px] file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:bg-[#0B4EA2] file:text-white"
                      />
                    </div>
                  </div>

                  {evidencePreview && (
                    <div className="flex items-center gap-3 pt-1">
                      <img
                        src={evidencePreview}
                        alt="Evidence preview"
                        className="w-20 h-16 object-cover rounded border border-[#CBD5E1]"
                      />
                      <span className="text-[11px] text-[#15803D] font-semibold">
                        Ready to upload as {evidenceStage} evidence
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={uploadingEvidence}
                      className="text-xs gap-1.5 bg-[#0B4EA2] text-white"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Upload Photo Evidence</span>
                    </Button>
                  </div>
                </form>

                {/* Uploaded Evidence Gallery */}
                {complaintEvidence.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {complaintEvidence.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]"
                      >
                        <img
                          src={ev.fileUrl}
                          alt={ev.caption || ev.stage}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-2.5 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                ev.stage === "AFTER"
                                  ? "bg-[#ECFDF3] text-[#15803D]"
                                  : ev.stage === "IN_PROGRESS"
                                  ? "bg-[#EAF2FF] text-[#0B4EA2]"
                                  : "bg-[#FFF7E6] text-[#B45309]"
                              }`}
                            >
                              {ev.stage}
                            </span>
                            {ev.verified && (
                              <span className="text-[#15803D] flex items-center gap-0.5 font-semibold">
                                <ShieldCheck className="w-3 h-3" /> Verified
                              </span>
                            )}
                          </div>
                          {ev.caption && (
                            <p className="text-[#475569] dark:text-[#94A3B8] line-clamp-2">{ev.caption}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final Resolution Signoff */}
                {selectedComplaint.status !== "RESOLVED" && (
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                        Final Resolution Sign-off
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          hasAfterEvidence
                            ? "bg-[#ECFDF3] text-[#15803D]"
                            : "bg-[#FEF2F2] text-[#DC2626]"
                        }`}
                      >
                        {hasAfterEvidence ? "AFTER Proof Uploaded" : "Requires AFTER Photo First"}
                      </span>
                    </div>
                    <textarea
                      rows={2}
                      value={resolveRemarks}
                      onChange={(e) => setResolveRemarks(e.target.value)}
                      placeholder="Summarize work completed, field crew verification notes..."
                      className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#0F172A]"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="success"
                        size="sm"
                        isLoading={resolving}
                        disabled={!hasAfterEvidence || !resolveRemarks.trim()}
                        onClick={() => handleComplaintStatus("RESOLVED")}
                        className="text-xs"
                      >
                        Mark Complaint Resolved
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
