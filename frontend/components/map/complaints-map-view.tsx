"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Complaint } from "@/types/complaint";
import { MasterIncident } from "@/types/incident";
import { incidentToComplaint } from "@/lib/db/incidents-db";

const MapplsDashboardMap = dynamic(
  () => import("./mappls-dashboard-map").then((m) => m.MapplsDashboardMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] bg-[#0F172A]/5 dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#1E293B] rounded-xl flex flex-col items-center justify-center gap-2 text-[#64748B] dark:text-[#94A3B8] text-xs font-semibold animate-pulse transition-colors">
        <div className="w-7 h-7 border-2 border-[#0B4EA2] dark:border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
        <span>Loading map and complaint locations...</span>
      </div>
    ),
  }
);

interface ComplaintsMapViewProps {
  complaints?: Complaint[];
  incidents?: MasterIncident[];
  onSelectComplaint?: (complaint: Complaint) => void;
  onSelectIncident?: (incident: MasterIncident) => void;
  userJurisdiction?: {
    divisionId?: string;
    authorityId?: string;
    departmentId?: string;
  };
}

export function ComplaintsMapView({
  incidents,
  onSelectComplaint,
  onSelectIncident,
  userJurisdiction,
}: ComplaintsMapViewProps) {
  const handleSelectIncident = (inc: MasterIncident) => {
    if (onSelectIncident) {
      onSelectIncident(inc);
    }
    if (onSelectComplaint) {
      onSelectComplaint(incidentToComplaint(inc));
    }
  };

  return (
    <MapplsDashboardMap
      incidents={incidents}
      onSelectIncident={handleSelectIncident}
      userJurisdiction={userJurisdiction}
    />
  );
}
