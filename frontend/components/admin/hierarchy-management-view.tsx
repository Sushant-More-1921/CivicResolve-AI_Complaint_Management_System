"use client";

import React, { useState } from "react";
import {
  DivisionInfo,
  DistrictInfo,
  LocalAuthorityInfo,
  DepartmentInfo,
} from "@/types/hierarchy";
import {
  INITIAL_DIVISIONS,
  INITIAL_DISTRICTS,
  INITIAL_AUTHORITIES,
  INITIAL_DEPARTMENTS,
} from "@/lib/api/hierarchy";
import { Button } from "@/components/ui/button";
import {
  Building2,
  FolderTree,
  Plus,
  Layers,
  Users,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function HierarchyManagementView() {
  const [divisions, setDivisions] = useState<DivisionInfo[]>(INITIAL_DIVISIONS);
  const [districts] = useState<DistrictInfo[]>(INITIAL_DISTRICTS);
  const [authorities, setAuthorities] = useState<LocalAuthorityInfo[]>(INITIAL_AUTHORITIES);
  const [departments, setDepartments] = useState<DepartmentInfo[]>(INITIAL_DEPARTMENTS);

  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("div-kolhapur");
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>("auth-kmc");

  // Modal State
  const [isAddDivisionOpen, setIsAddDivisionOpen] = useState(false);
  const [isAddAuthorityOpen, setIsAddAuthorityOpen] = useState(false);
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);

  // Form states
  const [newDivName, setNewDivName] = useState("");
  const [newDivHq, setNewDivHq] = useState("");

  const [newAuthName, setNewAuthName] = useState("");
  const [newAuthType, setNewAuthType] = useState<LocalAuthorityInfo["type"]>("MUNICIPAL_CORPORATION");

  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptHead, setNewDeptHead] = useState("");

  const handleCreateDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivName.trim()) return;
    const newDiv: DivisionInfo = {
      id: `div-${Date.now()}`,
      code: `${newDivName.slice(0, 3).toUpperCase()}-DIV`,
      name: newDivName.trim(),
      state: "Maharashtra",
      headquarters: newDivHq || newDivName,
      districtsCount: 2,
      authoritiesCount: 3,
      status: "ACTIVE",
    };
    setDivisions([...divisions, newDiv]);
    setNewDivName("");
    setNewDivHq("");
    setIsAddDivisionOpen(false);
  };

  const handleCreateAuthority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthName.trim()) return;
    const newAuth: LocalAuthorityInfo = {
      id: `auth-${Date.now()}`,
      code: newAuthName.slice(0, 4).toUpperCase(),
      name: newAuthName.trim(),
      type: newAuthType,
      districtId: districts[0]?.id || "dist-kolhapur",
      divisionId: selectedDivisionId,
      departmentsCount: 4,
    };
    setAuthorities([...authorities, newAuth]);
    setNewAuthName("");
    setIsAddAuthorityOpen(false);
  };

  const handleCreateDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    const newDept: DepartmentInfo = {
      id: `dept-${Date.now()}`,
      code: newDeptName.slice(0, 3).toUpperCase(),
      name: newDeptName.trim(),
      authorityId: selectedAuthorityId,
      headOfficerName: newDeptHead || "Designated Head",
      categories: [newDeptName],
      activeOfficersCount: 5,
    };
    setDepartments([...departments, newDept]);
    setNewDeptName("");
    setNewDeptHead("");
    setIsAddDeptOpen(false);
  };

  const activeDiv = divisions.find((d) => d.id === selectedDivisionId) || divisions[0];
  const activeDivAuthorities = authorities.filter((a) => a.divisionId === selectedDivisionId);
  const activeAuthDepts = departments.filter((d) => d.authorityId === selectedAuthorityId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] p-5 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-[#0B4EA2] dark:text-[#60A5FA]" />
            <h3 className="font-extrabold text-base sm:text-lg text-[#0F172A] dark:text-[#F8FAFC]">
              Administrative Hierarchy & Jurisdictions
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">
            Scalable model: <strong>State → Division → District/Local Authority → Department → Officer</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddDivisionOpen(true)}
            className="text-xs"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Division
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddAuthorityOpen(true)}
            className="text-xs"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Local Authority
          </Button>
        </div>
      </div>

      {/* 3-Column Hierarchy Explorer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* COLUMN 1: DIVISIONS */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs p-4 space-y-3 transition-colors">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-2">
            <span className="font-bold text-xs uppercase tracking-wider text-[#0B4EA2] dark:text-[#60A5FA] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0B4EA2] dark:text-[#60A5FA]" />
              1. Divisions ({divisions.length})
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">State Level</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {divisions.map((div) => {
              const isSelected = div.id === selectedDivisionId;
              return (
                <div
                  key={div.id}
                  onClick={() => setSelectedDivisionId(div.id)}
                  className={cn(
                    "p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between",
                    isSelected
                      ? "border-[#0B4EA2] dark:border-[#3B82F6] bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 text-[#0B4EA2] dark:text-[#60A5FA] font-semibold"
                      : "border-[#E2E8F0] dark:border-[#1E293B] bg-transparent hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                  )}
                >
                  <div>
                    <span className="block font-bold">{div.name}</span>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      HQ: {div.headquarters} • Code: {div.code}
                    </span>
                  </div>
                  <ChevronRight className={cn("w-4 h-4", isSelected ? "text-[#0B4EA2] dark:text-[#60A5FA]" : "text-[#CBD5E1] dark:text-[#475569]")} />
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 2: LOCAL AUTHORITIES IN SELECTED DIVISION */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs p-4 space-y-3 transition-colors">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-2">
            <span className="font-bold text-xs uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF]" />
              2. Local Authorities ({activeDivAuthorities.length})
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">in {activeDiv.name}</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activeDivAuthorities.map((auth) => {
              const isSelected = auth.id === selectedAuthorityId;
              return (
                <div
                  key={auth.id}
                  onClick={() => setSelectedAuthorityId(auth.id)}
                  className={cn(
                    "p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between",
                    isSelected
                      ? "border-[#0F766E] dark:border-[#2DD4BF] bg-[#ECFEFF] dark:bg-[#134E4A]/30 text-[#0F766E] dark:text-[#2DD4BF] font-semibold"
                      : "border-[#E2E8F0] dark:border-[#1E293B] bg-transparent hover:bg-[#F8FAFC] dark:hover:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC]"
                  )}
                >
                  <div>
                    <span className="block font-bold">{auth.name}</span>
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Type: {auth.type.replace("_", " ")}
                    </span>
                  </div>
                  <ChevronRight className={cn("w-4 h-4", isSelected ? "text-[#0F766E] dark:text-[#2DD4BF]" : "text-[#CBD5E1] dark:text-[#475569]")} />
                </div>
              );
            })}

            {activeDivAuthorities.length === 0 && (
              <div className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                No local authorities mapped yet under this division.
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: DEPARTMENTS UNDER SELECTED LOCAL AUTHORITY */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] shadow-xs p-4 space-y-3 transition-colors">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-2">
            <span className="font-bold text-xs uppercase tracking-wider text-[#B45309] dark:text-[#FBBF24] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24]" />
              3. Departments ({activeAuthDepts.length})
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddDeptOpen(true)}
              className="text-[11px] h-7 px-2"
            >
              + Add Dept
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activeAuthDepts.map((dept) => (
              <div
                key={dept.id}
                className="p-3 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#2D3748] text-xs space-y-1 bg-[#F8FAFC] dark:bg-[#161F30]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{dept.name}</span>
                  <span className="text-[10px] font-mono text-[#0B4EA2] dark:text-[#60A5FA] bg-[#EAF2FF] dark:bg-[#1E3A8A]/30 px-1.5 py-0.5 rounded">
                    {dept.code}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Head: {dept.headOfficerName || "Designated Officer"}
                </div>
                <div className="text-[10px] text-[#16A34A] dark:text-[#34D399] font-semibold">
                  {dept.activeOfficersCount} On-Duty Field Officers
                </div>
              </div>
            ))}

            {activeAuthDepts.length === 0 && (
              <div className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                No departments configured for this authority yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: ADD DIVISION */}
      {isAddDivisionOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-xl max-w-md w-full p-6 space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <h4 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">Add New Administrative Division</h4>
              <button type="button" onClick={() => setIsAddDivisionOpen(false)}>
                <X className="w-5 h-5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]" />
              </button>
            </div>
            <form onSubmit={handleCreateDivision} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#0F172A] dark:text-[#F8FAFC]">
                  Division Name (e.g. Nagpur Division) *
                </label>
                <input
                  type="text"
                  required
                  value={newDivName}
                  onChange={(e) => setNewDivName(e.target.value)}
                  placeholder="e.g. Nagpur Division"
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC] text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#0F172A] dark:text-[#F8FAFC]">Headquarters City</label>
                <input
                  type="text"
                  value={newDivHq}
                  onChange={(e) => setNewDivHq(e.target.value)}
                  placeholder="e.g. Nagpur"
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC] text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <Button variant="outline" size="sm" onClick={() => setIsAddDivisionOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Register Division
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD LOCAL AUTHORITY */}
      {isAddAuthorityOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-xl max-w-md w-full p-6 space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <h4 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">
                Add Local Authority in {activeDiv.name}
              </h4>
              <button type="button" onClick={() => setIsAddAuthorityOpen(false)}>
                <X className="w-5 h-5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]" />
              </button>
            </div>
            <form onSubmit={handleCreateAuthority} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#0F172A] dark:text-[#F8FAFC]">
                  Local Authority Name *
                </label>
                <input
                  type="text"
                  required
                  value={newAuthName}
                  onChange={(e) => setNewAuthName(e.target.value)}
                  placeholder="e.g. Solapur Municipal Corporation"
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC] text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#0F172A] dark:text-[#F8FAFC]">Authority Type</label>
                <select
                  value={newAuthType}
                  onChange={(e) => setNewAuthType(e.target.value as LocalAuthorityInfo["type"])}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC] text-sm"
                >
                  <option value="MUNICIPAL_CORPORATION" className="dark:bg-[#161F30]">Municipal Corporation (Maha Nagar Palika)</option>
                  <option value="MUNICIPAL_COUNCIL" className="dark:bg-[#161F30]">Municipal Council (Nagar Palika)</option>
                  <option value="ZILLA_PARISHAD" className="dark:bg-[#161F30]">Zilla Parishad (Rural District)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <Button variant="outline" size="sm" onClick={() => setIsAddAuthorityOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Register Authority
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEPARTMENT */}
      {isAddDeptOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] shadow-xl max-w-md w-full p-6 space-y-4 transition-colors">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B] pb-3">
              <h4 className="font-bold text-base text-[#0F172A] dark:text-[#F8FAFC]">Register New Department</h4>
              <button type="button" onClick={() => setIsAddDeptOpen(false)}>
                <X className="w-5 h-5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]" />
              </button>
            </div>
            <form onSubmit={handleCreateDept} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#0F172A] dark:text-[#F8FAFC]">Department Name *</label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Encroachment & Town Planning"
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC] text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1 text-[#0F172A] dark:text-[#F8FAFC]">Head of Department</label>
                <input
                  type="text"
                  value={newDeptHead}
                  onChange={(e) => setNewDeptHead(e.target.value)}
                  placeholder="e.g. Er. Sanjay Patil"
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-[#0F172A] dark:text-[#F8FAFC] text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                <Button variant="outline" size="sm" onClick={() => setIsAddDeptOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Add Department
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
