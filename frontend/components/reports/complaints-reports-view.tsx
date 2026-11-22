"use client";

import React, { useState } from "react";
import { Complaint } from "@/types/complaint";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Printer } from "lucide-react";

interface ComplaintsReportsViewProps {
  complaints: Complaint[];
}

export function ComplaintsReportsView({ complaints }: ComplaintsReportsViewProps) {
  const [dateRange, setDateRange] = useState("THIS_MONTH");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [isExporting, setIsExporting] = useState(false);

  const filtered = complaints.filter((c) => {
    const matchReg = selectedRegion === "ALL" || c.region === selectedRegion;
    const matchCat = selectedCategory === "ALL" || c.category === selectedCategory;
    return matchReg && matchCat;
  });

  const resolvedCount = filtered.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED").length;
  const escalatedCount = filtered.filter((c) => c.status === "ESCALATED").length;
  const inProgressCount = filtered.filter((c) => c.status === "IN_PROGRESS" || c.status === "ASSIGNED").length;

  // Real CSV export generator
  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const headers = [
        "Tracking ID",
        "Title",
        "Category",
        "Department",
        "Region",
        "Location",
        "Priority",
        "Status",
        "Assigned Officer",
        "Citizen Phone",
        "Date",
      ];

      const rows = filtered.map((c) => [
        `"${c.trackingNumber}"`,
        `"${c.title.replace(/"/g, '""')}"`,
        `"${c.category}"`,
        `"${c.departmentName || c.department || ""}"`,
        `"${c.region}"`,
        `"${c.location.replace(/"/g, '""')}"`,
        `"${c.priority}"`,
        `"${c.status}"`,
        `"${c.assignedOfficer || "Unassigned"}"`,
        `"${c.citizenMobile}"`,
        `"${c.date}"`,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `CIP_Grievance_Report_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 600);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#1E293B] pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-[#F8FAFC]">
              Government Grievance Audit & MIS Reporting
            </h3>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">
              Export standardized operational datasets for departmental reviews and administrative audits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs"
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Briefing
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportCSV}
              isLoading={isExporting}
              className="text-xs"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            >
              Download CSV Data
            </Button>
          </div>
        </div>

        {/* Filter selection controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              Time Period Filter
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
            >
              <option value="TODAY" className="dark:bg-[#161F30]">Today (06 Oct 2026)</option>
              <option value="LAST_7_DAYS" className="dark:bg-[#161F30]">Last 7 Days</option>
              <option value="THIS_MONTH" className="dark:bg-[#161F30]">Current Month (October 2026)</option>
              <option value="ALL_TIME" className="dark:bg-[#161F30]">Fiscal Year to Date</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              District Region Filter
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
            >
              <option value="ALL" className="dark:bg-[#161F30]">All District Zones</option>
              <option value="North Zone" className="dark:bg-[#161F30]">North Zone (Ward 12)</option>
              <option value="Central Zone" className="dark:bg-[#161F30]">Central Zone (Market Yard)</option>
              <option value="South Zone" className="dark:bg-[#161F30]">South Zone (Shahupuri)</option>
              <option value="East Zone" className="dark:bg-[#161F30]">East Zone (Shivaji Park)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
              Civic Category Filter
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] bg-white dark:bg-[#161F30] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6]"
            >
              <option value="ALL" className="dark:bg-[#161F30]">All Categories</option>
              <option value="Solid Waste" className="dark:bg-[#161F30]">Solid Waste</option>
              <option value="Water Supply" className="dark:bg-[#161F30]">Water Supply</option>
              <option value="Road Infrastructure" className="dark:bg-[#161F30]">Road Infrastructure</option>
              <option value="Drainage" className="dark:bg-[#161F30]">Drainage</option>
              <option value="Power & Lighting" className="dark:bg-[#161F30]">Power & Lighting</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs transition-colors">
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium block">Selected Dataset</span>
          <span className="text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 block">
            {filtered.length} Records
          </span>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#BBF7D0] dark:border-[#10B981]/30 bg-[#ECFDF3]/30 dark:bg-[#064E3B]/20 shadow-xs transition-colors">
          <span className="text-xs text-[#15803D] dark:text-[#34D399] font-medium block">Resolved Compliance</span>
          <span className="text-2xl font-extrabold text-[#15803D] dark:text-[#34D399] mt-1 block">
            {resolvedCount} Cases
          </span>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#FDE68A] dark:border-[#F59E0B]/30 bg-[#FFF7E6]/30 dark:bg-[#78350F]/20 shadow-xs transition-colors">
          <span className="text-xs text-[#B45309] dark:text-[#FBBF24] font-medium block">Under Processing</span>
          <span className="text-2xl font-extrabold text-[#B45309] dark:text-[#FBBF24] mt-1 block">
            {inProgressCount} Cases
          </span>
        </div>
        <div className="bg-white dark:bg-[#111827] p-4 rounded-xl border border-[#FECACA] dark:border-[#DC2626]/30 bg-[#FEF2F2]/30 dark:bg-[#7F1D1D]/20 shadow-xs transition-colors">
          <span className="text-xs text-[#DC2626] dark:text-[#F87171] font-medium block">Escalated SLA</span>
          <span className="text-2xl font-extrabold text-[#DC2626] dark:text-[#F87171] mt-1 block">
            {escalatedCount} Cases
          </span>
        </div>
      </div>

      {/* Dataset Preview Table */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs overflow-hidden transition-colors">
        <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
          <h4 className="font-bold text-sm sm:text-base text-[#0F172A] dark:text-[#F8FAFC]">
            Report Export Data Preview ({filtered.length} entries)
          </h4>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Complies with National Grievance Portal Data Standards
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] dark:bg-[#161F30] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#475569] dark:text-[#94A3B8] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-4">Tracking ID</th>
                <th className="py-2.5 px-4">Grievance Title</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Zone / Location</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Officer In-Charge</th>
                <th className="py-2.5 px-4">Logged Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-[#0B4EA2] dark:text-[#60A5FA]">
                    {item.trackingNumber}
                  </td>
                  <td className="py-2.5 px-4 max-w-xs truncate font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                    {item.title}
                  </td>
                  <td className="py-2.5 px-4 text-[#475569] dark:text-[#94A3B8]">{item.category}</td>
                  <td className="py-2.5 px-4 text-[#475569] dark:text-[#94A3B8]">
                    {item.region} • {item.location}
                  </td>
                  <td className="py-2.5 px-4 font-bold">{item.priority}</td>
                  <td className="py-2.5 px-4 font-semibold">{item.status}</td>
                  <td className="py-2.5 px-4 text-[#475569] dark:text-[#94A3B8]">
                    {item.assignedOfficer || "Unassigned"}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[#64748B] dark:text-[#94A3B8]">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
