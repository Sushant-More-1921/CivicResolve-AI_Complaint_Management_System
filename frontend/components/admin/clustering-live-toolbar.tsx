"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  UserCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import {
  ingestCitizenComplaint,
  assignOfficerToIncident,
  updateIncidentStatus,
  resetDatabaseToSeed,
  getStoredIncidents,
} from "@/lib/db/incidents-db";
import { emitRealTimeEvent } from "@/lib/realtime/events";

interface ClusteringLiveToolbarProps {
  onRefresh: () => void;
}

export function ClusteringLiveToolbar({ onRefresh }: ClusteringLiveToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 6000);
  };

  // 1. Simulate duplicate citizen report matching the Kolhapur garbage problem (Incident 1042)
  const handleSimulateClusterDuplicate = () => {
    const randomCitizen = `Citizen Neighbor ${Math.floor(100 + Math.random() * 900)}`;
    const randomPhone = `+91 98220 ${Math.floor(10000 + Math.random() * 90000)}`;

    const result = ingestCitizenComplaint({
      citizenName: randomCitizen,
      citizenMobile: randomPhone,
      category: "Solid Waste",
      description: "Severe garbage overflow and flies near school gate, urgently clear this dump.",
      location: "Kolhapur North, Ward 12, Near New High School",
      coordinates: { lat: 16.7121, lng: 74.2381 },
      channel: "MOBILE_APP",
    });

    emitRealTimeEvent("COMPLAINT_CLUSTERED", {
      incidentId: result.incident.id,
      incidentNumber: result.incident.incidentNumber,
      complaintCount: result.incident.complaintCount,
    });

    onRefresh();
    showNotice(
      `Cluster Matched: Report linked to ${result.incident.incidentNumber}. Complaint count updated to ${result.incident.complaintCount}.`
    );
  };

  // 2. Simulate brand new incident (No match)
  const handleSimulateNewIncident = () => {
    const locNumber = Math.floor(10 + Math.random() * 90);
    const result = ingestCitizenComplaint({
      citizenName: "New Citizen Caller",
      citizenMobile: "+91 99770 12345",
      category: "Electrical & Lighting",
      description: `Sparking transformer and short circuit on Colony Road #${locNumber}.`,
      location: `Kolhapur South, Colony Road #${locNumber}`,
      coordinates: { lat: 16.6800 + Math.random() * 0.02, lng: 74.2200 + Math.random() * 0.02 },
      channel: "TOLL_FREE_1916",
    });

    emitRealTimeEvent("NEW_INCIDENT_CREATED", {
      incidentId: result.incident.id,
      incidentNumber: result.incident.incidentNumber,
    });

    onRefresh();
    showNotice(
      `New Grievance Registered: ${result.incident.incidentNumber} lodged at ${result.incident.location}.`
    );
  };

  // 3. Simulate assigning an unassigned case (Assigned +1, Unassigned -1)
  const handleSimulateAssign = () => {
    const all = getStoredIncidents();
    const unassigned = all.find((i) => !i.assignedOfficerId && i.status !== "RESOLVED" && i.status !== "CLOSED");

    if (!unassigned) {
      showNotice("All active complaints currently have assigned officers.");
      return;
    }

    assignOfficerToIncident(unassigned.id, "off-1", "R. K. Patil", "Administrative Dispatch Controller");
    emitRealTimeEvent("OFFICER_ASSIGNED", { incidentId: unassigned.id });
    onRefresh();
    showNotice(
      `Assigned: ${unassigned.incidentNumber} allocated to Officer R. K. Patil.`
    );
  };

  // 4. Simulate status progress (Pending -1, In Progress +1)
  const handleSimulateProgress = () => {
    const all = getStoredIncidents();
    const pending = all.find((i) => i.status === "ASSIGNED" || i.status === "SUBMITTED");

    if (!pending) {
      showNotice("No pending complaints available to transition to In Progress.");
      return;
    }

    updateIncidentStatus(pending.id, "IN_PROGRESS", undefined, "Field Unit Verification");
    emitRealTimeEvent("STATUS_CHANGED", { incidentId: pending.id, status: "IN_PROGRESS" });
    onRefresh();
    showNotice(
      `Status Updated: ${pending.incidentNumber} changed from Pending to In Progress.`
    );
  };

  // 5. Simulate resolution (In Progress -1, Resolved +1)
  const handleSimulateResolve = () => {
    const all = getStoredIncidents();
    const inProg = all.find((i) => i.status === "IN_PROGRESS");

    if (!inProg) {
      showNotice("No complaint currently in In-Progress state to resolve.");
      return;
    }

    updateIncidentStatus(
      inProg.id,
      "RESOLVED",
      {
        imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80",
        remarks: "Area cleaned by municipal sanitation crew. Photo uploaded.",
        uploadedBy: "Inspector R. K. Patil",
      },
      "On-site Remediation Complete"
    );

    emitRealTimeEvent("STATUS_CHANGED", { incidentId: inProg.id, status: "RESOLVED" });
    onRefresh();
    showNotice(
      `Resolved: ${inProg.incidentNumber} marked as Resolved with on-site evidence.`
    );
  };

  // 6. Reset database to seed data
  const handleReset = () => {
    resetDatabaseToSeed();
    emitRealTimeEvent("DATABASE_RESET");
    onRefresh();
    showNotice("Database restored to initial baseline seed state.");
  };

  return (
    <div className="bg-white border border-[#CBD5E1] rounded-xl text-[#0F172A] shadow-2xs overflow-hidden">
      {/* Top Bar Row */}
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E2E8F0] text-[#0F172A] flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-[#0B4EA2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-[#0F172A]">
                Workflow & Simulation Controls
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#EAF2FF] text-[#0B4EA2] border border-[#BFDBFE]">
                Connected
              </span>
            </div>
            <p className="text-[11px] text-[#64748B]">
              Simulate citizen submissions, automated clustering, and officer status transitions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#334155] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>{isExpanded ? "Hide Test Controls" : "Test Workflow Controls"}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Real-time Notification Banner */}
      {notification && (
        <div className="bg-[#EFF6FF] text-[#1E40AF] px-4 py-2 text-xs font-medium border-t border-[#BFDBFE] flex items-center justify-between">
          <span>{notification}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[#1E40AF] hover:text-[#0F172A] font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Expanded Interactive Simulation Panel */}
      {isExpanded && (
        <div className="p-4 border-t border-[#E2E8F0] bg-white space-y-3">
          <div className="text-[11px] text-[#64748B]">
            Execute workflow actions to verify live data updates across dashboard metrics:
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* 1. Cluster Duplicate Report */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateClusterDuplicate}
              className="text-xs h-8 border-[#CBD5E1] text-[#334155]"
              leftIcon={<Layers className="w-3.5 h-3.5 text-[#0B4EA2]" />}
            >
              +1 Duplicate Report (Cluster Test)
            </Button>

            {/* 2. Brand New Incident */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateNewIncident}
              className="text-xs h-8 border-[#CBD5E1] text-[#334155]"
              leftIcon={<PlusCircle className="w-3.5 h-3.5 text-[#16A34A]" />}
            >
              +1 New Grievance
            </Button>

            {/* 3. Assign Case */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateAssign}
              className="text-xs h-8 border-[#CBD5E1] text-[#334155]"
              leftIcon={<UserCheck className="w-3.5 h-3.5 text-[#0B4EA2]" />}
            >
              Assign Officer
            </Button>

            {/* 4. Progress Case */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateProgress}
              className="text-xs h-8 border-[#CBD5E1] text-[#334155]"
              leftIcon={<Clock className="w-3.5 h-3.5 text-[#D97706]" />}
            >
              Mark In Progress
            </Button>

            {/* 5. Resolve Case */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateResolve}
              className="text-xs h-8 border-[#CBD5E1] text-[#334155]"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />}
            >
              Resolve Complaint
            </Button>

            {/* 6. Reset */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-[#64748B] hover:text-[#0F172A] text-xs h-8 ml-auto"
              leftIcon={<RotateCcw className="w-3 h-3" />}
            >
              Reset Data
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
