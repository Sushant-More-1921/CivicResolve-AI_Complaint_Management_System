"use client";

import React, { useState } from "react";
import { Officer, OfficerStatus } from "@/types/officer";
import { Complaint } from "@/types/complaint";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface OfficersManagementViewProps {
  officers: Officer[];
  complaints: Complaint[];
  onReassignComplaint: (complaintId: string, officerId: string, officerName: string) => void;
}

export function OfficersManagementView({
  officers,
  complaints,
  onReassignComplaint,
}: OfficersManagementViewProps) {
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [assignModalOfficer, setAssignModalOfficer] = useState<Officer | null>(null);

  const filteredOfficers = officers.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.badgeId.toLowerCase().includes(search.toLowerCase()) ||
      o.department.toLowerCase().includes(search.toLowerCase());
    const matchesDept = selectedDept === "ALL" || o.department === selectedDept;
    const matchesStatus = selectedStatus === "ALL" || o.status === selectedStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const statusBadge = (status: OfficerStatus) => {
    switch (status) {
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ECFDF3] dark:bg-[#064E3B]/20 text-[#15803D] dark:text-[#34D399] border border-[#BBF7D0] dark:border-[#10B981]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] dark:bg-[#34D399]" /> Available
          </span>
        );
      case "ON_DUTY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF2FF] dark:bg-[#1E3A8A]/20 text-[#0B4EA2] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0B4EA2] dark:bg-[#60A5FA]" /> On Duty
          </span>
        );
      case "BUSY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FFF7E6] dark:bg-[#78350F]/20 text-[#B45309] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#F59E0B]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] dark:bg-[#FBBF24]" /> Heavy Workload
          </span>
        );
      case "OFF_DUTY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] dark:bg-[#161F30] text-[#64748B] dark:text-[#94A3B8] border border-[#CBD5E1] dark:border-[#2D3748]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" /> Off Duty
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs transition-colors">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium block">Total Field Officers</span>
          <span className="text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 block">
            {officers.length} Active
          </span>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs transition-colors">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium block">Available for Dispatch</span>
          <span className="text-2xl font-extrabold text-[#15803D] dark:text-[#34D399] mt-1 block">
            {officers.filter((o) => o.status === "AVAILABLE" || o.status === "ON_DUTY").length}
          </span>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs transition-colors">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium block">Average SLA Efficiency</span>
          <span className="text-2xl font-extrabold text-[#0B4EA2] dark:text-[#60A5FA] mt-1 block">94.2%</span>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs transition-colors">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium block">Avg Resolution Speed</span>
          <span className="text-2xl font-extrabold text-[#5B21B6] dark:text-[#C084FC] mt-1 block">4.1 Hours</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search officer by name, badge ID, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
          >
            <option value="ALL" className="dark:bg-[#161F30]">All Departments</option>
            <option value="Waste Management" className="dark:bg-[#161F30]">Waste Management</option>
            <option value="Hydraulics & Water" className="dark:bg-[#161F30]">Hydraulics & Water</option>
            <option value="Public Works (PWD)" className="dark:bg-[#161F30]">Public Works (PWD)</option>
            <option value="Sanitation & Sewerage" className="dark:bg-[#161F30]">Sanitation & Sewerage</option>
            <option value="Power & Street Lighting" className="dark:bg-[#161F30]">Power & Street Lighting</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
          >
            <option value="ALL" className="dark:bg-[#161F30]">All Statuses</option>
            <option value="AVAILABLE" className="dark:bg-[#161F30]">AVAILABLE</option>
            <option value="ON_DUTY" className="dark:bg-[#161F30]">ON DUTY</option>
            <option value="BUSY" className="dark:bg-[#161F30]">BUSY</option>
            <option value="OFF_DUTY" className="dark:bg-[#161F30]">OFF DUTY</option>
          </select>
        </div>
      </div>

      {/* Officers Roster Table */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">
              Department Officers Roster & Workload ({filteredOfficers.length})
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Real-time workload distribution, contact details, and complaint assignment.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#475569] dark:text-[#94A3B8] font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Officer / Badge ID</th>
                <th className="py-3 px-4">Department & Zone</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4">Active Workload</th>
                <th className="py-3 px-4">Resolved All-Time</th>
                <th className="py-3 px-4">Performance Score</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
              {filteredOfficers.map((o) => (
                <tr key={o.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="block font-bold text-[#0F172A] dark:text-[#F8FAFC]">{o.name}</span>
                    <span className="block font-mono text-[11px] text-[#0B4EA2] dark:text-[#60A5FA] font-semibold">
                      {o.badgeId} • {o.designation}
                    </span>
                    <span className="block text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                      {o.mobileNumber}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="block font-medium text-[#0F172A] dark:text-[#F8FAFC]">{o.department}</span>
                    <span className="block text-xs text-[#64748B] dark:text-[#94A3B8]">{o.assignedZone}</span>
                  </td>

                  <td className="py-3.5 px-4">{statusBadge(o.status)}</td>

                  <td className="py-3.5 px-4 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs",
                        o.assignedComplaintsCount >= 5
                          ? "bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] font-bold"
                          : "bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA]"
                      )}
                    >
                      {o.assignedComplaintsCount} Complaints
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-[#15803D] dark:text-[#34D399] font-bold">
                    {o.resolvedComplaintsCount} Cases
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[#E2E8F0] dark:bg-[#1E293B] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#16A34A] dark:bg-[#10B981] h-full rounded-full"
                          style={{ width: `${o.performanceScore}%` }}
                        />
                      </div>
                      <span className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">
                        {o.performanceScore}%
                      </span>
                    </div>
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block mt-0.5">
                      Avg: {o.averageResolutionHours} hrs/case
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setAssignModalOfficer(o)}
                      className="text-xs h-8"
                      disabled={o.status === "OFF_DUTY"}
                    >
                      Assign Case
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Assign Modal */}
      {assignModalOfficer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-xl max-w-lg w-full p-6 space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <div>
                <h3 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">
                  Assign Complaint to {assignModalOfficer.name}
                </h3>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {assignModalOfficer.badgeId} • {assignModalOfficer.department}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOfficer(null)}
                className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
              Select from pending or unassigned civic grievances to allocate:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {complaints.slice(0, 5).map((comp) => (
                <div
                  key={comp.id}
                  className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-transparent dark:bg-[#161F30] hover:border-[#0B4EA2] dark:hover:border-[#3B82F6] transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-[#0B4EA2] dark:text-[#60A5FA]">
                      {comp.trackingNumber}
                    </span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] block truncate max-w-xs">
                      {comp.title}
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">{comp.location}</span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => {
                      onReassignComplaint(comp.id, assignModalOfficer.id, assignModalOfficer.name);
                      setAssignModalOfficer(null);
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAssignModalOfficer(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
