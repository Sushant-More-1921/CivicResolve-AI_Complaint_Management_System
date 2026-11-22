"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo, useId } from "react";
import {
  MapPin,
  Phone,
  ZoomIn,
  ZoomOut,
  Compass,
  Filter,
  Sliders,
  Layers,
  Flame,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
  ChevronRight,
  Calendar,
  TrendingUp,
  BarChart3,
  Info,
  Shield,
  Activity,
  RefreshCw,
  Eye,
  EyeOff,
  Navigation,
  Tag,
  Radio,
} from "lucide-react";
import { PriorityBadge } from "@/components/common/priority-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { MasterIncident, IncidentFilterParams } from "@/types/incident";
import { getStoredIncidents } from "@/lib/db/incidents-db";
import { subscribeToRealTime } from "@/lib/realtime/events";
import { INITIAL_DIVISIONS, INITIAL_DEPARTMENTS } from "@/lib/api/hierarchy";
import {
  getBackendMapConfig,
  getGeoIntelligenceApi,
  GeoIntelligenceResult,
  HotspotData,
  MarkerPoint,
  RegionalAggregateData,
  UnmappedComplaintData,
} from "@/lib/api/maps-client";

declare global {
  interface Window {
    mappls?: any;
    MapmyIndia?: any;
  }
}

interface MapplsDashboardMapProps {
  incidents?: MasterIncident[];
  onSelectIncident?: (incident: MasterIncident) => void;
  className?: string;
  userJurisdiction?: {
    divisionId?: string;
    authorityId?: string;
    departmentId?: string;
  };
}

// Kolhapur Municipal Corporation & Central City Coordinates
const KOLHAPUR_CENTER = { lat: 16.6946, lng: 74.2232 };
const DEFAULT_MAPPLS_KEY = "gwvhdnntjogomslkhygqjpcapzwymvpsofdd";

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function loadMapplsSdk(apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (!apiKey || apiKey.trim().length < 5) return resolve(false);
    if (window.mappls && window.mappls.Map) return resolve(true);

    const existing = document.getElementById("mappls-sdk-script") as HTMLScriptElement | null;
    if (existing) {
      if (window.mappls && window.mappls.Map) return resolve(true);
      const poll = setInterval(() => {
        if (window.mappls && window.mappls.Map) {
          clearInterval(poll);
          resolve(true);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(poll);
        resolve(Boolean(window.mappls?.Map));
      }, 4000);
      return;
    }

    const script = document.createElement("script");
    script.id = "mappls-sdk-script";
    script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const poll = setInterval(() => {
        if (window.mappls && window.mappls.Map) {
          clearInterval(poll);
          resolve(true);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        resolve(Boolean(window.mappls?.Map));
      }, 3000);
    };

    script.onerror = () => {
      console.warn("Mappls Web SDK script failed from primary CDN, trying alternative...");
      const altScript = document.createElement("script");
      altScript.id = "mappls-sdk-script-alt";
      altScript.src = `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(apiKey)}/map_sdk?v=3.0&layer=vector`;
      altScript.onload = () => {
        setTimeout(() => resolve(Boolean(window.mappls?.Map)), 100);
      };
      altScript.onerror = () => resolve(false);
      document.head.appendChild(altScript);
    };

    document.head.appendChild(script);
  });
}

export interface HotspotStyleConfig {
  strokeColor: string;
  fillColor: string;
  strokeWeight: number;
  strokeOpacity: number;
  fillOpacity: number;
  glowColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  notationTag: string;
  gradientStart: string;
  gradientEnd: string;
  priorityDescription: string;
}

/**
 * Styling configuration for Hotspot Regions:
 * Compact small radius circles with clear color notation and complaint count badges.
 */
export function getHotspotIntensityConfig(intensity: string): HotspotStyleConfig {
  switch (intensity) {
    case "CRITICAL":
      return {
        strokeColor: "#DC2626", // Red-600
        fillColor: "#EF4444",   // Red-500
        strokeWeight: 2.2,
        strokeOpacity: 0.90,
        fillOpacity: 0.22,
        glowColor: "rgba(220, 38, 38, 0.32)",
        badgeBg: "bg-red-50 dark:bg-red-950/60",
        badgeBorder: "border-red-300 dark:border-red-800",
        badgeText: "text-red-700 dark:text-red-300",
        notationTag: "CRITICAL RISK ZONE",
        gradientStart: "#DC2626",
        gradientEnd: "#991B1B",
        priorityDescription: "Critical emergency risk area requiring rapid dispatch",
      };
    case "HIGH":
      return {
        strokeColor: "#EA580C", // Orange-600
        fillColor: "#F97316",   // Orange-500
        strokeWeight: 2.0,
        strokeOpacity: 0.85,
        fillOpacity: 0.18,
        glowColor: "rgba(234, 88, 12, 0.28)",
        badgeBg: "bg-orange-50 dark:bg-orange-950/60",
        badgeBorder: "border-orange-300 dark:border-orange-800",
        badgeText: "text-orange-700 dark:text-orange-300",
        notationTag: "HIGH DENSITY HOTSPOT",
        gradientStart: "#EA580C",
        gradientEnd: "#C2410C",
        priorityDescription: "High-density complaint zone requiring scheduled field team",
      };
    case "MODERATE":
      return {
        strokeColor: "#D97706", // Amber-600
        fillColor: "#F59E0B",   // Amber-500
        strokeWeight: 1.8,
        strokeOpacity: 0.80,
        fillOpacity: 0.15,
        glowColor: "rgba(217, 119, 6, 0.24)",
        badgeBg: "bg-amber-50 dark:bg-amber-950/60",
        badgeBorder: "border-amber-300 dark:border-amber-800",
        badgeText: "text-amber-700 dark:text-amber-300",
        notationTag: "MODERATE CONCENTRATION",
        gradientStart: "#D97706",
        gradientEnd: "#B45309",
        priorityDescription: "Moderate density cluster under scheduled maintenance",
      };
    case "LOW":
    default:
      return {
        strokeColor: "#2563EB", // Blue-600
        fillColor: "#3B82F6",   // Blue-500
        strokeWeight: 1.5,
        strokeOpacity: 0.75,
        fillOpacity: 0.12,
        glowColor: "rgba(37, 99, 235, 0.20)",
        badgeBg: "bg-blue-50 dark:bg-blue-950/60",
        badgeBorder: "border-blue-300 dark:border-blue-800",
        badgeText: "text-blue-700 dark:text-blue-300",
        notationTag: "ROUTINE / LOW PRIORITY",
        gradientStart: "#2563EB",
        gradientEnd: "#1D4ED8",
        priorityDescription: "Routine cluster monitored via standard SLA workflow",
      };
  }
}

/**
 * Creates dynamic SVG icon for an individual complaint marker with priority styling
 */
function getMarkerIcon(priority: string, isOverdue: boolean = false): string {
  const isCritical = priority === "VERY_HIGH" || priority === "CRITICAL" || priority === "URGENT";
  const isHigh = priority === "HIGH";
  const isMedium = priority === "MEDIUM";

  const color = isCritical ? "#DC2626" : isHigh ? "#EA580C" : isMedium ? "#D97706" : "#2563EB";
  const symbol = isOverdue ? "!" : isCritical ? "!" : "•";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">
    <defs>
      <filter id="mshadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity="0.25"/>
      </filter>
    </defs>
    <path d="M15 0 C6.7 0 0 6.7 0 15 C0 25.5 15 38 15 38 C15 38 30 25.5 30 15 C30 6.7 23.3 0 15 0 Z" fill="${color}" stroke="#ffffff" stroke-width="2" filter="url(#mshadow)"/>
    <circle cx="15" cy="14" r="8.5" fill="#ffffff"/>
    <text x="15" y="18" font-size="11" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="${color}" text-anchor="middle">${symbol}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Small radius circle center badge with explicit complaint count
 */
function getHotspotCountIcon(intensity: string, totalCount: number): string {
  const cfg = getHotspotIntensityConfig(intensity);
  const size = 62;
  const radius = size / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <filter id="hcount-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.4"/>
      </filter>
    </defs>
    <!-- Outer halo ring -->
    <circle cx="${radius}" cy="${radius}" r="${radius - 2}" fill="${cfg.glowColor}" stroke="${cfg.strokeColor}" stroke-width="1.8" stroke-dasharray="${intensity === 'CRITICAL' ? '4 2' : 'none'}"/>
    <!-- Center circle disc -->
    <circle cx="${radius}" cy="${radius}" r="${radius - 7}" fill="${cfg.strokeColor}" stroke="#ffffff" stroke-width="2.5" filter="url(#hcount-shadow)"/>
    <!-- Prominent Complaint Count Number -->
    <text x="${radius}" y="${radius - 1}" font-size="15" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#ffffff" text-anchor="middle">${totalCount}</text>
    <!-- Explicit COMPLAINTS Label -->
    <text x="${radius}" y="${radius + 10}" font-size="6.5" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#ffffff" text-anchor="middle" letter-spacing="0.4">COMPLAINTS</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Creates dynamic on-map Notation Callout card for a Hotspot Region with prominent complaint count
 */
function getHotspotNotationCalloutIcon(hotspot: HotspotData, smallRadius: number): string {
  const cfg = getHotspotIntensityConfig(hotspot.intensity);
  const cleanName = escapeXml(hotspot.name.replace(/Hotspot$/i, "").trim());
  const category = escapeXml((hotspot.dominantCategory || "Civic Issue").toUpperCase());
  const radiusStr = `${Math.round(smallRadius)}m`;
  const complaints = hotspot.totalComplaints || 0;
  const unresolved = hotspot.unresolvedCount || 0;

  const width = 250;
  const height = 82;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="nshadow-${hotspot.id}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.32"/>
      </filter>
      <linearGradient id="ngrad-${hotspot.id}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${cfg.gradientStart}"/>
        <stop offset="100%" stop-color="${cfg.gradientEnd}"/>
      </linearGradient>
    </defs>

    <!-- Pointer Needle pointing down to anchor (125, 78) -->
    <path d="M 116 60 L 125 78 L 134 60 Z" fill="${cfg.strokeColor}" filter="url(#nshadow-${hotspot.id})"/>
    <circle cx="125" cy="78" r="3.5" fill="#ffffff" stroke="${cfg.strokeColor}" stroke-width="2.5"/>

    <!-- Main Card Body -->
    <rect x="3" y="3" width="244" height="58" rx="8" fill="#ffffff" stroke="${cfg.strokeColor}" stroke-width="2" filter="url(#nshadow-${hotspot.id})"/>

    <!-- Header Strip with Category & Intensity Notation -->
    <rect x="3" y="3" width="244" height="22" rx="7" fill="url(#ngrad-${hotspot.id})"/>
    <rect x="3" y="15" width="244" height="10" fill="url(#ngrad-${hotspot.id})"/>

    <!-- Status Bullet & Intensity Tag -->
    <circle cx="14" cy="14" r="3" fill="#ffffff"/>
    <text x="22" y="17.5" font-size="9" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#ffffff" letter-spacing="0.5">
      ${cfg.notationTag} HOTSPOT ZONE
    </text>

    <!-- Explicit Complaint Count Tag on Top Right -->
    <rect x="154" y="5" width="88" height="15" rx="4" fill="#ffffff" opacity="0.95"/>
    <text x="198" y="16" font-size="8.5" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="${cfg.strokeColor}" text-anchor="middle">
      ${complaints} ${complaints === 1 ? 'COMPLAINT' : 'COMPLAINTS'}
    </text>

    <!-- Hotspot Area Name -->
    <text x="10" y="38" font-size="11" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#0F172A">
      ${cleanName.length > 25 ? cleanName.slice(0, 24) + '…' : cleanName}
    </text>

    <!-- Prominent Complaint Count & Details -->
    <text x="10" y="52" font-size="9" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" fill="#475569">
      Count: <tspan font-weight="900" fill="${cfg.strokeColor}">${complaints} Complaints</tspan> • ~${radiusStr} circle${unresolved > 0 ? ` • ${unresolved} pending` : ''}
    </text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function MapplsDashboardMap({
  incidents: propIncidents,
  onSelectIncident,
  className = "",
  userJurisdiction,
}: MapplsDashboardMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapplsMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const reactId = useId();
  const containerId = `mappls-canvas-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // API Key & Map Initialization State
  const [apiKey, setApiKey] = useState<string>(
    process.env.NEXT_PUBLIC_MAPPLS_API_KEY || DEFAULT_MAPPLS_KEY
  );
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Layer Toggles
  const [showHotspotsLayer, setShowHotspotsLayer] = useState(true);
  const [showHotspotRegions, setShowHotspotRegions] = useState(true);
  const [showHotspotNotations, setShowHotspotNotations] = useState(true);
  const [showMarkersLayer, setShowMarkersLayer] = useState(true);
  const [showUnresolvedOnly, setShowUnresolvedOnly] = useState(false);
  const [showPriorityHalos, setShowPriorityHalos] = useState(true);

  // Filters State
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(
    userJurisdiction?.divisionId || "ALL"
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(
    userJurisdiction?.departmentId || "ALL"
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [dateRange, setDateRange] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [intensityFilter, setIntensityFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // UI Panels State
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showUnmappedDrawer, setShowUnmappedDrawer] = useState(false);
  const [showRegionalModal, setShowRegionalModal] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotData | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MarkerPoint | null>(null);

  // Fallback Vector Map State (when Mappls SDK is initializing or offline)
  const [fallbackZoom, setFallbackZoom] = useState(1);
  const [fallbackPan, setFallbackPan] = useState({ x: 0, y: 0 });
  const [isDraggingFallback, setIsDraggingFallback] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Data State: Live Database Geo-Intelligence
  const [geoData, setGeoData] = useState<GeoIntelligenceResult | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);

  // 1. Fetch Backend Map Key & Config
  useEffect(() => {
    let isMounted = true;
    getBackendMapConfig()
      .then((cfg) => {
        if (!isMounted) return;
        if (cfg.mapplsApiKey && cfg.mapplsApiKey.trim().length > 5) {
          setApiKey(cfg.mapplsApiKey);
        }
      })
      .catch((err) => {
        console.warn("Notice loading map config from backend:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load Mappls SDK Script
  useEffect(() => {
    let isMounted = true;
    const effectiveKey = apiKey || process.env.NEXT_PUBLIC_MAPPLS_API_KEY || DEFAULT_MAPPLS_KEY;

    loadMapplsSdk(effectiveKey).then((loaded) => {
      if (!isMounted) return;
      if (loaded && window.mappls?.Map) {
        setIsSdkReady(true);
      } else {
        setLoadError(null);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  // 3. Fetch Geo-Intelligence directly from Database
  const fetchIntelligence = useCallback(async () => {
    setIsFetchingData(true);
    try {
      const result = await getGeoIntelligenceApi({
        divisionId: selectedDivisionId,
        departmentId: selectedDepartmentId,
        category: selectedCategory,
        priority: selectedPriority,
        status: showUnresolvedOnly ? "UNRESOLVED" : selectedStatus,
        dateRange,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        minPts: 1,
        epsMeters: 500,
      });

      if (result) {
        setGeoData(result);
      }
    } catch (err) {
      console.warn("Failed fetching geointelligence:", err);
    } finally {
      setIsFetchingData(false);
    }
  }, [
    selectedDivisionId,
    selectedDepartmentId,
    selectedCategory,
    selectedPriority,
    selectedStatus,
    showUnresolvedOnly,
    dateRange,
    startDate,
    endDate,
  ]);

  // Load and subscribe to real-time events
  useEffect(() => {
    fetchIntelligence();
    const unsub = subscribeToRealTime(() => {
      fetchIntelligence();
    });
    return () => {
      unsub();
    };
  }, [fetchIntelligence]);

  // Fallback hotspots derived directly from incidents props (guarantees complaint counts are always present)
  const fallbackHotspotsFromProps = useMemo<HotspotData[]>(() => {
    if (!propIncidents || propIncidents.length === 0) return [];

    const groups: { [key: string]: typeof propIncidents } = {};
    propIncidents.forEach((inc) => {
      const lat = inc.coordinates?.lat;
      const lng = inc.coordinates?.lng;
      if (!lat || !lng) return;
      const area = inc.location?.split(",")[0]?.trim() || inc.region || "Kolhapur Zone";
      if (!groups[area]) groups[area] = [];
      groups[area].push(inc);
    });

    return Object.entries(groups).map(([area, items], idx) => {
      const totalComplaints = items.reduce((sum, item) => sum + (item.complaintCount || 1), 0);
      const avgLat = items.reduce((sum, item) => sum + item.coordinates.lat, 0) / items.length;
      const avgLng = items.reduce((sum, item) => sum + item.coordinates.lng, 0) / items.length;
      const hasCritical = items.some((i) => i.priority === "CRITICAL" || i.priority === "VERY_HIGH" || (i.priority as string) === "URGENT");
      const hasHigh = items.some((i) => i.priority === "HIGH");
      const intensity = hasCritical || totalComplaints >= 10 ? "CRITICAL" : hasHigh || totalComplaints >= 5 ? "HIGH" : totalComplaints >= 3 ? "MODERATE" : "LOW";
      const dominantCategory = items[0]?.category || "Civic Issue";
      const unresolvedCount = items.filter((i) => i.status !== "RESOLVED" && (i.status as string) !== "CLOSED").reduce((sum, i) => sum + (i.complaintCount || 1), 0);
      const radiusMeters = intensity === "CRITICAL" ? 280 : intensity === "HIGH" ? 240 : intensity === "MODERATE" ? 200 : 160;

      const resolutionRate = totalComplaints > 0 ? Math.round((items.filter((i) => i.status === "RESOLVED").length / items.length) * 100) : 0;
      const latestComplaintDate = items[0]?.lastReportedAt || items[0]?.firstReportedAt || new Date().toISOString();

      return {
        id: `prop-hotspot-${idx}`,
        name: `${area} Hotspot`,
        center: { lat: avgLat, lng: avgLng },
        radiusMeters,
        intensity: intensity as any,
        attentionZone: intensity === "CRITICAL" ? "CRITICAL_ATTENTION" : intensity === "HIGH" ? "HIGH_ATTENTION" : "NORMAL",
        totalComplaints,
        priorityScore: totalComplaints * 2 + (hasCritical ? 10 : 0),
        priorityBreakdown: {
          critical: items.filter((i) => i.priority === "CRITICAL" || i.priority === "VERY_HIGH").length,
          high: items.filter((i) => i.priority === "HIGH").length,
          medium: items.filter((i) => i.priority === "MEDIUM").length,
          low: items.filter((i) => i.priority === "LOW").length,
        },
        statusBreakdown: {
          pending: items.filter((i) => i.status === "SUBMITTED" || (i.status as string) === "ASSIGNED" || (i.status as string) === "VALIDATING").length,
          inProgress: items.filter((i) => i.status === "IN_PROGRESS").length,
          resolved: items.filter((i) => i.status === "RESOLVED").length,
          rejected: 0,
        },
        categoryBreakdown: {
          [dominantCategory]: totalComplaints,
        },
        dominantCategory,
        dominantPriority: hasCritical ? "CRITICAL" : hasHigh ? "HIGH" : "MEDIUM",
        unresolvedCount,
        overdueCount: items.filter((i) => i.isSlaBreached).length,
        isRecurring: totalComplaints > 3,
        resolutionRate,
        latestComplaintDate,
        complaints: items.map((i) => ({
          id: i.id,
          trackingNumber: i.incidentNumber,
          title: i.title,
          category: i.category,
          priority: i.priority,
          status: i.status,
          location: i.location,
          latitude: i.coordinates.lat,
          longitude: i.coordinates.lng,
          isOverdue: !!i.isSlaBreached,
          createdAt: i.firstReportedAt || new Date().toISOString(),
          citizenName: i.supportingReports?.[0]?.citizenName || (i as any).citizenName || "Verified Citizen",
          citizenMobile: i.supportingReports?.[0]?.citizenMobile || (i as any).citizenMobile || "+91 98220 00000",
        })),
      };
    });
  }, [propIncidents]);

  // Fallback markers derived directly from incident props
  const fallbackMarkersFromProps = useMemo<MarkerPoint[]>(() => {
    if (!propIncidents) return [];
    return propIncidents
      .filter((inc) => inc.coordinates?.lat && inc.coordinates?.lng)
      .map((inc) => ({
        id: inc.id,
        trackingNumber: inc.incidentNumber,
        title: inc.title,
        category: inc.category,
        priority: inc.priority,
        status: inc.status,
        location: inc.location,
        latitude: inc.coordinates.lat,
        longitude: inc.coordinates.lng,
        isOverdue: !!inc.isSlaBreached,
        createdAt: inc.firstReportedAt || new Date().toISOString(),
        citizenName: inc.supportingReports?.[0]?.citizenName || (inc as any).citizenName || "Verified Citizen",
        citizenMobile: inc.supportingReports?.[0]?.citizenMobile || (inc as any).citizenMobile || "+91 98220 00000",
      }));
  }, [propIncidents]);

  // Filtered hotspots & markers based on search and intensity filter
  const displayedHotspots = useMemo(() => {
    let list = (geoData && geoData.hotspots && geoData.hotspots.length > 0) ? geoData.hotspots : fallbackHotspotsFromProps;
    if (!list.length) return [];
    if (intensityFilter !== "ALL") {
      if (intensityFilter === "CRITICAL") {
        list = list.filter((h) => h.intensity === "CRITICAL");
      } else if (intensityFilter === "HIGH_CRITICAL") {
        list = list.filter((h) => h.intensity === "CRITICAL" || h.intensity === "HIGH");
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          h.dominantCategory.toLowerCase().includes(q) ||
          h.complaints.some((c) => c.location.toLowerCase().includes(q) || c.trackingNumber.toLowerCase().includes(q))
      );
    }
    return list;
  }, [geoData, fallbackHotspotsFromProps, intensityFilter, searchQuery]);

  const displayedMarkers = useMemo(() => {
    let list = (geoData && geoData.individualMarkers && geoData.individualMarkers.length > 0) ? geoData.individualMarkers : fallbackMarkersFromProps;
    if (!list.length) return [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.location.toLowerCase().includes(q) ||
          m.trackingNumber.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [geoData, fallbackMarkersFromProps, searchQuery]);

  /**
   * Determine the Major Hotspot Region in Kolhapur to keep the map focused on:
   */
  const majorHotspot = useMemo(() => {
    if (!displayedHotspots.length) return null;
    const khHotspots = displayedHotspots.filter(
      (h) =>
        Number(h.center.lat) >= 16.4 &&
        Number(h.center.lat) <= 17.1 &&
        Number(h.center.lng) >= 74.0 &&
        Number(h.center.lng) <= 74.6
    );
    const candidates = khHotspots.length > 0 ? khHotspots : displayedHotspots;
    return (
      candidates.find((h) => h.intensity === "CRITICAL") ||
      [...candidates].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))[0]
    );
  }, [displayedHotspots]);

  // 4. Initialize Mappls Map ONCE safely without crashing on unmount/re-instantiation
  useEffect(() => {
    if (!isSdkReady || !window.mappls?.Map) return;
    const container = mapContainerRef.current;
    if (!container) return;

    // Prevent re-instantiating if map instance is already alive
    if (mapplsMapRef.current) return;

    let mapInstance: any = null;

    try {
      // Safely purge stale entry from Mappls internal mapList to prevent "destroy of undefined" crash
      if (typeof window !== "undefined" && window.mappls?.mapList && window.mappls.mapList[containerId]) {
        try {
          delete window.mappls.mapList[containerId];
        } catch {}
      }

      const map = new window.mappls.Map(containerId, {
        center: KOLHAPUR_CENTER,
        zoom: 13.5,
        layer: "vector",
        draggable: true,
        zoomControl: true,
      });

      mapplsMapRef.current = map;
      mapInstance = map;

      const onMapLoad = () => {
        setMapLoaded(true);
        if (typeof map.resize === "function") {
          map.resize();
        }
        setTimeout(() => {
          if (map && typeof map.resize === "function") {
            map.resize();
          }
        }, 300);
      };

      if (typeof map.addListener === "function") {
        map.addListener("load", onMapLoad);
      }
      if (typeof map.on === "function") {
        map.on("load", onMapLoad);
      }

      const timer = setTimeout(() => {
        setMapLoaded(true);
      }, 1500);

      return () => {
        clearTimeout(timer);
        if (mapInstance) {
          try {
            if (typeof mapInstance.remove === "function") {
              mapInstance.remove();
            }
          } catch {
            // Silently swallow Mappls internal destroy notices on DOM detach
          }
        }
        mapplsMapRef.current = null;
        setMapLoaded(false);
      };
    } catch (err) {
      console.warn("Mappls map instantiation notice (using fallback vector engine):", err);
      setMapLoaded(false);
    }
  }, [isSdkReady, containerId]);

  // 5. Plot Dynamic Markers, Small Radius Circles & Complaint Counts
  useEffect(() => {
    if (!mapLoaded || !mapplsMapRef.current || !window.mappls) return;
    const map = mapplsMapRef.current;

    // Clean up previous markers
    markersRef.current.forEach((marker) => {
      try {
        if (typeof marker.remove === "function") {
          marker.remove();
        } else if (typeof marker.setMap === "function") {
          marker.setMap(null);
        }
      } catch {}
    });
    markersRef.current = [];

    // Clean up previous circles
    circlesRef.current.forEach((circle) => {
      try {
        if (typeof circle.remove === "function") {
          circle.remove();
        } else if (typeof circle.setMap === "function") {
          circle.setMap(null);
        }
      } catch {}
    });
    circlesRef.current = [];

    // A. Plot DBSCAN Hotspot Regions: Small Radius Circle with Complaint Counts
    if (showHotspotsLayer) {
      displayedHotspots.forEach((hotspot) => {
        const lat = Number(hotspot.center.lat);
        const lng = Number(hotspot.center.lng);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

        const cfg = getHotspotIntensityConfig(hotspot.intensity);

        // Small radius circle: 160m to 280m based on intensity
        const smallRadiusMeters =
          hotspot.intensity === "CRITICAL" ? 280 :
          hotspot.intensity === "HIGH" ? 240 :
          hotspot.intensity === "MODERATE" ? 200 : 160;

        // 1. Draw Mappls Small Geographic Circle (Hotspot Region) with semi-transparent fill
        if (showHotspotRegions && typeof window.mappls.Circle === "function") {
          try {
            const circle = new window.mappls.Circle({
              map: map,
              center: { lat, lng },
              radius: smallRadiusMeters,
              fillColor: cfg.fillColor,
              fillOpacity: cfg.fillOpacity,
              strokeColor: cfg.strokeColor,
              strokeOpacity: cfg.strokeOpacity,
              strokeWeight: cfg.strokeWeight,
            });

            if (typeof circle.addListener === "function") {
              circle.addListener("click", () => {
                setSelectedHotspot(hotspot);
                setSelectedMarker(null);
              });
            }

            circlesRef.current.push(circle);
          } catch (err) {
            console.warn("Notice plotting Mappls Circle:", err);
          }
        }

        // 2. Draw Center Marker with Complaint Counts inside the circle
        try {
          const countIconUrl = getHotspotCountIcon(hotspot.intensity, hotspot.totalComplaints);
          const countMarker = new window.mappls.Marker({
            map: map,
            position: { lat, lng },
            icon: countIconUrl,
            width: 62,
            height: 62,
            fitbounds: false,
          });

          if (typeof countMarker.addListener === "function") {
            countMarker.addListener("click", () => {
              setSelectedHotspot(hotspot);
              setSelectedMarker(null);
            });
          }

          markersRef.current.push(countMarker);
        } catch (err) {
          console.warn("Error adding complaint count marker:", err);
        }

        // 3. Draw On-Map Zone Notation Callout Card (if enabled)
        if (showHotspotNotations) {
          try {
            const notationIconUrl = getHotspotNotationCalloutIcon(hotspot, smallRadiusMeters);
            const notationMarker = new window.mappls.Marker({
              map: map,
              position: { lat, lng },
              icon: notationIconUrl,
              width: 250,
              height: 82,
              offset: [0, -42],
              fitbounds: false,
            });

            if (typeof notationMarker.addListener === "function") {
              notationMarker.addListener("click", () => {
                setSelectedHotspot(hotspot);
                setSelectedMarker(null);
              });
            }

            markersRef.current.push(notationMarker);
          } catch (err) {
            console.warn("Error adding hotspot notation marker:", err);
          }
        }
      });
    }

    // B. Plot Individual Grievance Pins
    if (showMarkersLayer) {
      displayedMarkers.forEach((markerItem) => {
        const lat = Number(markerItem.latitude);
        const lng = Number(markerItem.longitude);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

        try {
          const iconUrl = getMarkerIcon(markerItem.priority, markerItem.isOverdue);
          const marker = new window.mappls.Marker({
            map: map,
            position: { lat, lng },
            icon: iconUrl,
            width: 30,
            height: 38,
            fitbounds: false,
          });

          if (typeof marker.addListener === "function") {
            marker.addListener("click", () => {
              setSelectedMarker(markerItem);
              setSelectedHotspot(null);
              if (propIncidents && onSelectIncident) {
                const raw = propIncidents.find(
                  (i) => i.id === markerItem.id || i.incidentNumber === markerItem.trackingNumber
                );
                if (raw) onSelectIncident(raw);
              }
            });
          }

          markersRef.current.push(marker);
        } catch (err) {
          console.warn("Error adding grievance pin:", err);
        }
      });
    }

    // Keep map centered directly on Kolhapur or Major Hotspot Region
    if (map && typeof map.setCenter === "function") {
      const target = majorHotspot
        ? { lat: Number(majorHotspot.center.lat), lng: Number(majorHotspot.center.lng) }
        : KOLHAPUR_CENTER;
      try {
        map.setCenter(target);
        if (typeof map.setZoom === "function") {
          map.setZoom(13.5);
        }
      } catch {}
    }
  }, [
    mapLoaded,
    displayedHotspots,
    displayedMarkers,
    showHotspotsLayer,
    showHotspotRegions,
    showHotspotNotations,
    showMarkersLayer,
    propIncidents,
    onSelectIncident,
    majorHotspot,
  ]);

  // Controls for Mappls or Fallback
  const handleZoomIn = () => {
    if (mapLoaded && mapplsMapRef.current && typeof mapplsMapRef.current.setZoom === "function") {
      try {
        const current = mapplsMapRef.current.getZoom?.() || 13;
        mapplsMapRef.current.setZoom(current + 1);
      } catch {}
    } else {
      setFallbackZoom((z) => Math.min(z + 0.35, 3.5));
    }
  };

  const handleZoomOut = () => {
    if (mapLoaded && mapplsMapRef.current && typeof mapplsMapRef.current.setZoom === "function") {
      try {
        const current = mapplsMapRef.current.getZoom?.() || 13;
        mapplsMapRef.current.setZoom(Math.max(1, current - 1));
      } catch {}
    } else {
      setFallbackZoom((z) => Math.max(z - 0.35, 0.65));
    }
  };

  const handleResetCenter = () => {
    const target = majorHotspot
      ? { lat: Number(majorHotspot.center.lat), lng: Number(majorHotspot.center.lng) }
      : KOLHAPUR_CENTER;

    if (mapLoaded && mapplsMapRef.current && typeof mapplsMapRef.current.setCenter === "function") {
      try {
        mapplsMapRef.current.setCenter(target);
        mapplsMapRef.current.setZoom?.(13.5);
      } catch {}
    } else {
      setFallbackZoom(1);
      setFallbackPan({ x: 0, y: 0 });
    }
  };

  const zoomToHotspot = (lat: number, lng: number) => {
    if (mapLoaded && mapplsMapRef.current && typeof mapplsMapRef.current.setCenter === "function") {
      try {
        mapplsMapRef.current.setCenter({ lat, lng });
        mapplsMapRef.current.setZoom?.(15);
      } catch {}
    }
  };

  // Kolhapur-focused bounding box for Fallback Vector Map
  const fallbackBounds = useMemo(() => {
    const khLats = displayedHotspots
      .map((h) => Number(h.center.lat))
      .concat(displayedMarkers.map((m) => Number(m.latitude)))
      .filter((n) => !isNaN(n) && n >= 16.5 && n <= 17.0);

    const khLngs = displayedHotspots
      .map((h) => Number(h.center.lng))
      .concat(displayedMarkers.map((m) => Number(m.longitude)))
      .filter((n) => !isNaN(n) && n >= 74.0 && n <= 74.5);

    const minLat = khLats.length > 0 ? Math.min(...khLats) - 0.025 : 16.66;
    const maxLat = khLats.length > 0 ? Math.max(...khLats) + 0.025 : 16.73;
    const minLng = khLngs.length > 0 ? Math.min(...khLngs) - 0.03 : 74.19;
    const maxLng = khLngs.length > 0 ? Math.max(...khLngs) + 0.03 : 74.28;

    return { minLat, maxLat, minLng, maxLng };
  }, [displayedHotspots, displayedMarkers]);

  // Fallback map projection helpers
  const svgWidth = 1000;
  const svgHeight = 580;
  const pad = 60;

  const latToY = useCallback(
    (lat: number) => {
      const { minLat, maxLat } = fallbackBounds;
      const ratio = (maxLat - lat) / (maxLat - minLat || 0.01);
      return pad + ratio * (svgHeight - 2 * pad);
    },
    [fallbackBounds]
  );

  const lngToX = useCallback(
    (lng: number) => {
      const { minLng, maxLng } = fallbackBounds;
      const ratio = (lng - minLng) / (maxLng - minLng || 0.01);
      return pad + ratio * (svgWidth - 2 * pad);
    },
    [fallbackBounds]
  );

  // Fallback Map Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDraggingFallback(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: fallbackPan.x,
      panY: fallbackPan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingFallback) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setFallbackPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingFallback(false);
  };

  const summary = (geoData && geoData.summary && geoData.summary.totalComplaints > 0) ? geoData.summary : {
    totalComplaints: propIncidents ? propIncidents.reduce((s, i) => s + (i.complaintCount || 1), 0) : 0,
    totalMapped: propIncidents ? propIncidents.filter((i) => i.coordinates?.lat && i.coordinates?.lng).length : 0,
    totalUnmapped: propIncidents ? propIncidents.filter((i) => !i.coordinates?.lat || !i.coordinates?.lng).length : 0,
    totalHotspots: displayedHotspots.length,
    criticalHotspots: displayedHotspots.filter((h) => h.intensity === "CRITICAL").length,
    highHotspots: displayedHotspots.filter((h) => h.intensity === "HIGH").length,
    unresolvedComplaints: propIncidents ? propIncidents.filter((i) => i.status !== "RESOLVED" && (i.status as string) !== "CLOSED").reduce((s, i) => s + (i.complaintCount || 1), 0) : 0,
    criticalComplaints: propIncidents ? propIncidents.filter((i) => i.priority === "CRITICAL" || i.priority === "VERY_HIGH" || (i.priority as string) === "URGENT").reduce((s, i) => s + (i.complaintCount || 1), 0) : 0,
    resolutionRate: propIncidents && propIncidents.length > 0 ? Math.round((propIncidents.filter((i) => i.status === "RESOLVED" || (i.status as string) === "CLOSED").length / propIncidents.length) * 100) : 0,
  };

  return (
    <div
      className={`relative flex flex-col w-full rounded-2xl overflow-hidden border border-[#CBD5E1] shadow-sm bg-white ${className}`}
    >
      {/* ==================== 1. TOP COMMAND & KPI INTELLIGENCE BAR ==================== */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-white border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0B4EA2] border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8] shadow-xs">
            <Flame size={19} className="text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-wide text-white">
                CivicResolve Geospatial Intelligence & Hotspots
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0B4EA2]/80 border border-[#38BDF8]/50 text-[#38BDF8]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Kolhapur DBSCAN Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Small radius circles, prominent complaint counts, and on-map zone notations
            </p>
          </div>
        </div>

        {/* Live KPI Badges */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <span className="text-slate-400">Total Complaints:</span>
            <span className="font-extrabold text-white font-mono">{summary.totalComplaints}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1.5 rounded-lg border border-slate-700">
            <span className="text-slate-400">Mapped Complaints:</span>
            <span className="font-bold text-emerald-400 font-mono">{summary.totalMapped}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-red-950/70 px-2.5 py-1.5 rounded-lg border border-red-800/50 text-red-300">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-bold font-mono">{summary.criticalHotspots} Critical Zones</span>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-950/70 px-2.5 py-1.5 rounded-lg border border-amber-800/50 text-amber-300">
            <span className="font-bold font-mono">{summary.unresolvedComplaints} Unresolved Complaints</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-950/70 px-2.5 py-1.5 rounded-lg border border-emerald-800/50 text-emerald-300">
            <TrendingUp size={12} />
            <span className="font-bold font-mono">{summary.resolutionRate}% Solved</span>
          </div>

          {summary.totalUnmapped > 0 && (
            <button
              type="button"
              onClick={() => setShowUnmappedDrawer(true)}
              className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-lg border border-amber-500/40 transition-colors cursor-pointer"
              title="Click to view complaints logged with unavailable GPS"
            >
              <AlertTriangle size={13} className="text-amber-400" />
              <span className="font-bold">{summary.totalUnmapped} No GPS</span>
            </button>
          )}

          {/* Quick Regional Analytics Button */}
          <button
            type="button"
            onClick={() => setShowRegionalModal(true)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors"
            title="View Regional Complaint Volumes"
          >
            <BarChart3 size={13} />
            <span>Regions</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchIntelligence}
            disabled={isFetchingData}
            title="Refresh Geospatial Data"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetchingData ? "animate-spin" : ""} />
          </button>

          {/* Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowFilterDrawer(!showFilterDrawer)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              showFilterDrawer ? "bg-[#0B4EA2] text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
          >
            <Filter size={13} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* ==================== 2. LAYER CONTROLS BAR ==================== */}
      <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#334155]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#64748B] font-semibold flex items-center gap-1">
            <Layers size={13} className="text-[#0B4EA2]" />
            <span>Map Layers:</span>
          </span>

          {/* Hotspots Layer Toggle */}
          <button
            type="button"
            onClick={() => setShowHotspotsLayer(!showHotspotsLayer)}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all border ${
              showHotspotsLayer
                ? "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
                : "bg-white border-[#CBD5E1] text-[#94A3B8]"
            }`}
          >
            <Flame size={12} />
            <span>DBSCAN Hotspots ({displayedHotspots.length})</span>
          </button>

          {/* Colored Geographic Regions Toggle */}
          <button
            type="button"
            onClick={() => setShowHotspotRegions(!showHotspotRegions)}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all border ${
              showHotspotRegions
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : "bg-white border-[#CBD5E1] text-[#94A3B8]"
            }`}
            title="Toggle small radius geographic circles"
          >
            <Radio size={12} />
            <span>Small Radius Circles</span>
          </button>

          {/* On-Map Notations / Labels Toggle */}
          <button
            type="button"
            onClick={() => setShowHotspotNotations(!showHotspotNotations)}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all border ${
              showHotspotNotations
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-[#CBD5E1] text-[#94A3B8]"
            }`}
            title="Toggle on-map zone notation callouts"
          >
            <Tag size={12} />
            <span>Zone Notations ({showHotspotNotations ? "Visible" : "Hidden"})</span>
          </button>

          {/* Markers Layer Toggle */}
          <button
            type="button"
            onClick={() => setShowMarkersLayer(!showMarkersLayer)}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all border ${
              showMarkersLayer
                ? "bg-[#EAF2FF] border-[#BFDBFE] text-[#0B4EA2]"
                : "bg-white border-[#CBD5E1] text-[#94A3B8]"
            }`}
          >
            <MapPin size={12} />
            <span>Grievance Pins ({displayedMarkers.length})</span>
          </button>

          {/* Unresolved Only Toggle */}
          <button
            type="button"
            onClick={() => setShowUnresolvedOnly(!showUnresolvedOnly)}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition-all border ${
              showUnresolvedOnly
                ? "bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]"
                : "bg-white border-[#CBD5E1] text-[#64748B]"
            }`}
          >
            <Clock size={12} />
            <span>Unresolved Zones Only</span>
          </button>
        </div>

        {/* Date Filter Quick Indicator */}
        <div className="flex items-center gap-2 text-[#64748B]">
          <Calendar size={13} />
          <span>Period: <strong className="text-[#0F172A]">{dateRange.toUpperCase()}</strong></span>
        </div>
      </div>

      {/* Quick-Jump Hotspots with Prominent Complaint Counts */}
      {displayedHotspots.length > 0 && (
        <div className="bg-slate-100 dark:bg-[#161F30] px-4 py-2 border-b border-slate-200 dark:border-[#1E293B] flex items-center gap-2 overflow-x-auto scrollbar-thin text-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0 flex items-center gap-1">
            <Flame size={12} className="text-red-500" />
            Complaint Counts by Hotspot:
          </span>
          <div className="flex items-center gap-2">
            {displayedHotspots.map((h) => {
              const cfg = getHotspotIntensityConfig(h.intensity);
              const isSelected = selectedHotspot?.id === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    zoomToHotspot(Number(h.center.lat), Number(h.center.lng));
                    setSelectedHotspot(h);
                    setSelectedMarker(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-xs shrink-0 cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-blue-500 shadow-sm"
                      : "hover:bg-white dark:hover:bg-[#1E293B]"
                  }`}
                  style={{
                    backgroundColor: isSelected ? cfg.fillColor : undefined,
                    borderColor: cfg.strokeColor,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.strokeColor }}
                  />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {h.name.replace(/Hotspot$/i, "").trim()}
                  </span>
                  <span
                    className="font-extrabold px-1.5 py-0.5 rounded-full text-[10px] text-white"
                    style={{ backgroundColor: cfg.strokeColor }}
                  >
                    {h.totalComplaints} {h.totalComplaints === 1 ? "Complaint" : "Complaints"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 3. MAIN MAP CANVAS AREA ==================== */}
      <div className="relative w-full h-[580px] bg-slate-900 overflow-hidden select-none">
        {/* Native Mappls Canvas Container: static element with containerId */}
        <div
          ref={mapContainerRef}
          id={containerId}
          className={`w-full h-full ${mapLoaded ? "block" : "hidden"}`}
        />

        {/* Fallback Interactive Vector Geospatial Canvas (Focused squarely on Kolhapur & Major Hotspot Region) */}
        {!mapLoaded && (
          <div
            className="w-full h-full relative cursor-grab active:cursor-grabbing bg-[#0B132B] overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <svg
              className="w-full h-full pointer-events-auto"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                transform: `translate(${fallbackPan.x}px, ${fallbackPan.y}px) scale(${fallbackZoom})`,
                transformOrigin: "center center",
                transition: isDraggingFallback ? "none" : "transform 0.15s ease-out",
              }}
            >
              <defs>
                {/* Background Grid Pattern */}
                <pattern id="geo-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1E293B" strokeWidth="0.8" strokeDasharray="3 3"/>
                </pattern>
                {/* Radial gradient for territory center */}
                <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1E293B" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#0B132B" stopOpacity="1"/>
                </radialGradient>
                {/* Shadow for callout badges */}
                <filter id="fshadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5"/>
                </filter>
              </defs>

              {/* Base terrain background */}
              <rect width={svgWidth} height={svgHeight} fill="#0B132B" />
              <rect width={svgWidth} height={svgHeight} fill="url(#map-glow)" />
              <rect width={svgWidth} height={svgHeight} fill="url(#geo-grid)" opacity="0.65" />

              {/* Geographic Territory Roads & Landmark Outlines for Kolhapur */}
              <g opacity="0.28" stroke="#38BDF8" strokeWidth="1" fill="none">
                <path d="M 120 280 C 250 290 400 320 520 280 C 650 240 780 260 920 300" strokeWidth="2.5" stroke="#334155"/>
                <path d="M 500 80 C 520 200 480 360 520 520" strokeWidth="2" stroke="#334155"/>
                <path d="M 300 160 C 450 260 600 340 750 440" strokeWidth="1.5" stroke="#1E293B"/>
                <circle cx="510" cy="280" r="180" stroke="#334155" strokeDasharray="6 4" strokeWidth="1"/>
              </g>

              {/* Key Kolhapur Landmark Notations */}
              <g fontSize="10" fontWeight="600" fill="#64748B" textAnchor="middle">
                <text x="500" y="260">Kolhapur Central KMC</text>
                <text x="360" y="320">Rankala Lake Zone</text>
                <text x="640" y="240">Rajarampuri Ward</text>
                <text x="750" y="160">Shiroli Industrial Area</text>
                <text x="420" y="180">Bhausingji / Mahalaxmi</text>
              </g>

              {/* A. RENDER SMALL RADIUS CIRCLES WITH COMPLAINT COUNTS & NOTATIONS */}
              {showHotspotsLayer &&
                displayedHotspots.map((hotspot) => {
                  const lat = Number(hotspot.center.lat);
                  const lng = Number(hotspot.center.lng);
                  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

                  const cx = lngToX(lng);
                  const cy = latToY(lat);
                  const cfg = getHotspotIntensityConfig(hotspot.intensity);

                  // Compact small radius in pixels (24px to 34px)
                  const radiusPx =
                    hotspot.intensity === "CRITICAL" ? 34 :
                    hotspot.intensity === "HIGH" ? 30 :
                    hotspot.intensity === "MODERATE" ? 26 : 22;

                  const isSelected = selectedHotspot?.id === hotspot.id;
                  const smallRadiusMeters =
                    hotspot.intensity === "CRITICAL" ? 280 :
                    hotspot.intensity === "HIGH" ? 240 :
                    hotspot.intensity === "MODERATE" ? 200 : 160;

                  return (
                    <g key={`region-${hotspot.id}`} className="transition-all duration-200">
                      {/* 1. Small Radius Circle */}
                      {showHotspotRegions && (
                        <>
                          {/* Outer subtle warning halo */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radiusPx + (isSelected ? 6 : 4)}
                            fill="none"
                            stroke={cfg.strokeColor}
                            strokeWidth={isSelected ? 2 : 1}
                            strokeOpacity={0.40}
                            strokeDasharray={hotspot.intensity === "CRITICAL" ? "4 2" : "none"}
                          />
                          {/* Small Radius Circle Body */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={radiusPx}
                            fill={cfg.fillColor}
                            fillOpacity={isSelected ? cfg.fillOpacity + 0.15 : cfg.fillOpacity}
                            stroke={cfg.strokeColor}
                            strokeWidth={isSelected ? 3 : cfg.strokeWeight}
                            strokeOpacity={cfg.strokeOpacity}
                            className="cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedHotspot(hotspot);
                              setSelectedMarker(null);
                            }}
                          >
                            <title>{`${hotspot.name} - ${hotspot.intensity} Hotspot (~${smallRadiusMeters}m circle, ${hotspot.totalComplaints} complaints)`}</title>
                          </circle>
                        </>
                      )}

                      {/* 2. Hotspot Center Pin with Prominent Complaint Count */}
                      <g
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedHotspot(hotspot);
                          setSelectedMarker(null);
                        }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={radiusPx > 26 ? 22 : 19}
                          fill={cfg.strokeColor}
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          filter="url(#fshadow)"
                        />
                        <text
                          x={cx}
                          y={cy - 2}
                          fill="#ffffff"
                          fontSize="12.5"
                          fontWeight="900"
                          textAnchor="middle"
                          className="pointer-events-none select-none font-mono"
                        >
                          {hotspot.totalComplaints}
                        </text>
                        <text
                          x={cx}
                          y={cy + 8}
                          fill="#ffffff"
                          fontSize="6.5"
                          fontWeight="900"
                          letterSpacing="0.4"
                          textAnchor="middle"
                          className="pointer-events-none select-none"
                        >
                          COMPLAINTS
                        </text>
                      </g>

                      {/* Circle Bottom Tag: Persistent Complaint Count & Radius */}
                      <g transform={`translate(${cx}, ${cy + radiusPx + 11})`} className="pointer-events-none select-none">
                        <rect
                          x="-54"
                          y="-9"
                          width="108"
                          height="18"
                          rx="9"
                          fill="#0F172A"
                          stroke={cfg.strokeColor}
                          strokeWidth="1.5"
                          opacity="0.95"
                        />
                        <text
                          x="0"
                          y="3"
                          fill="#ffffff"
                          fontSize="8"
                          fontWeight="800"
                          textAnchor="middle"
                        >
                          {hotspot.totalComplaints} Complaints (~{smallRadiusMeters}m)
                        </text>
                      </g>

                      {/* 3. On-Map Zone Notation Callout Card (Anchored directly over center) */}
                      {showHotspotNotations && (
                        <g
                          transform={`translate(${cx - 125}, ${cy - radiusPx - 64})`}
                          className="cursor-pointer hover:scale-105 transition-transform"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHotspot(hotspot);
                            setSelectedMarker(null);
                          }}
                        >
                          {/* Pointer needle touching circle top */}
                          <path
                            d="M 116 52 L 125 66 L 134 52 Z"
                            fill={cfg.strokeColor}
                            filter="url(#fshadow)"
                          />
                          {/* Card body */}
                          <rect
                            x="0"
                            y="0"
                            width="250"
                            height="52"
                            rx="8"
                            fill="#FFFFFF"
                            stroke={cfg.strokeColor}
                            strokeWidth="2"
                            filter="url(#fshadow)"
                          />
                          {/* Top Header Strip with Intensity & Count */}
                          <rect
                            x="0"
                            y="0"
                            width="250"
                            height="20"
                            rx="7"
                            fill={cfg.strokeColor}
                          />
                          <rect
                            x="0"
                            y="12"
                            width="250"
                            height="8"
                            fill={cfg.strokeColor}
                          />
                          <circle cx="12" cy="10" r="3" fill="#FFFFFF"/>
                          <text
                            x="20"
                            y="13.5"
                            fill="#FFFFFF"
                            fontSize="8.5"
                            fontWeight="800"
                            letterSpacing="0.4"
                          >
                            {cfg.notationTag} HOTSPOT ZONE
                          </text>

                          {/* Highlighted Complaint Count Badge on Top Right */}
                          <rect
                            x="152"
                            y="3"
                            width="92"
                            height="14"
                            rx="3"
                            fill="#ffffff"
                            opacity="0.95"
                          />
                          <text
                            x="198"
                            y="13"
                            fill={cfg.strokeColor}
                            fontSize="8"
                            fontWeight="900"
                            textAnchor="middle"
                          >
                            {hotspot.totalComplaints} {hotspot.totalComplaints === 1 ? "Complaint" : "Complaints"}
                          </text>

                          {/* Zone Name & Dominant Category Notation */}
                          <text
                            x="8"
                            y="32"
                            fill="#0F172A"
                            fontSize="10"
                            fontWeight="800"
                          >
                            {hotspot.name.replace(/Hotspot$/i, "").trim()}
                          </text>
                          <text
                            x="8"
                            y="45"
                            fill="#64748B"
                            fontSize="8.5"
                            fontWeight="600"
                          >
                            Count: <tspan fontWeight="800" fill={cfg.strokeColor}>{hotspot.totalComplaints} Complaints</tspan> • {hotspot.dominantCategory.toUpperCase()} • ~{smallRadiusMeters}m
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

              {/* B. RENDER INDIVIDUAL GRIEVANCE PINS */}
              {showMarkersLayer &&
                displayedMarkers.map((marker) => {
                  const lat = Number(marker.latitude);
                  const lng = Number(marker.longitude);
                  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

                  const mx = lngToX(lng);
                  const my = latToY(lat);
                  const isCritical =
                    marker.priority === "VERY_HIGH" ||
                    marker.priority === "CRITICAL" ||
                    marker.priority === "URGENT";
                  const isHigh = marker.priority === "HIGH";
                  const color = isCritical ? "#DC2626" : isHigh ? "#EA580C" : "#2563EB";

                  return (
                    <g
                      key={`marker-${marker.id}`}
                      className="cursor-pointer hover:scale-125 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarker(marker);
                        setSelectedHotspot(null);
                        if (propIncidents && onSelectIncident) {
                          const raw = propIncidents.find(
                            (i) => i.id === marker.id || i.incidentNumber === marker.trackingNumber
                          );
                          if (raw) onSelectIncident(raw);
                        }
                      }}
                    >
                      <circle cx={mx} cy={my} r="7" fill={color} stroke="#ffffff" strokeWidth="2" filter="url(#fshadow)"/>
                      <circle cx={mx} cy={my} r="2.5" fill="#ffffff"/>
                      <title>{`${marker.trackingNumber}: ${marker.title}`}</title>
                    </g>
                  );
                })}
            </svg>

            {/* Vector Map Active Watermark */}
            <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-slate-900/85 border border-slate-700/80 text-[10px] text-slate-300 backdrop-blur-xs flex items-center gap-1.5 z-10 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Kolhapur Geospatial View • Small Radius Hotspots Active</span>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isFetchingData && (
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-30 text-white">
            <div className="w-8 h-8 border-3 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold tracking-wide">
              Calculating Spatial Hotspots & Clusters...
            </span>
          </div>
        )}

        {/* Load Notice / Error Banner */}
        {loadError && (
          <div className="absolute top-4 left-4 right-4 bg-amber-500/95 text-slate-900 px-4 py-2.5 rounded-xl shadow-lg z-30 text-xs font-semibold flex items-center justify-between">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} className="text-slate-900 hover:opacity-75 font-bold ml-2">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Floating Zoom & Compass Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 shadow-md">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-white/95 dark:bg-[#111827]/95 hover:bg-white dark:hover:bg-[#161F30] text-slate-700 dark:text-[#CBD5E1] hover:text-slate-900 flex items-center justify-center transition-all border border-slate-200 dark:border-[#1E293B] shadow-xs"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-white/95 dark:bg-[#111827]/95 hover:bg-white dark:hover:bg-[#161F30] text-slate-700 dark:text-[#CBD5E1] hover:text-slate-900 flex items-center justify-center transition-all border border-slate-200 dark:border-[#1E293B] shadow-xs"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleResetCenter}
            className="w-8 h-8 rounded-lg bg-white/95 dark:bg-[#111827]/95 hover:bg-white dark:hover:bg-[#161F30] text-slate-700 dark:text-[#CBD5E1] hover:text-slate-900 flex items-center justify-center transition-all border border-slate-200 dark:border-[#1E293B] shadow-xs"
            title="Center Kolhapur / Major Hotspot"
          >
            <Compass size={16} />
          </button>
        </div>

        {/* ==================== A. SELECTED HOTSPOT INFORMATION PANEL ==================== */}
        {selectedHotspot && (
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-[#1E293B] max-w-md w-full animate-in fade-in slide-in-from-bottom-3 max-h-[480px] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    selectedHotspot.intensity === "CRITICAL"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : selectedHotspot.intensity === "HIGH"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {selectedHotspot.intensity} HOTSPOT
                </span>
                <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-mono">
                  Score: <strong>{selectedHotspot.priorityScore}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHotspot(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 dark:text-[#CBD5E1]"
              >
                <X size={15} />
              </button>
            </div>

            <h4 className="font-bold text-base text-slate-900 dark:text-[#F8FAFC] leading-snug mb-1">
              {selectedHotspot.name}
            </h4>

            {/* Geographic Coverage & Radius Notation */}
            <div className="my-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#161F30] border border-slate-200 dark:border-[#1E293B] text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <Radio size={12} className="text-[#0B4EA2]" />
                  <span>Coverage Radius:</span>
                </span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {Math.round(selectedHotspot.radiusMeters)} meters (~{Math.round(selectedHotspot.radiusMeters * 2)}m spread)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-1">
                  <Tag size={12} className="text-[#0B4EA2]" />
                  <span>Dominant Civic Issue:</span>
                </span>
                <span className="font-bold text-[#0B4EA2] dark:text-[#38BDF8]">
                  {selectedHotspot.dominantCategory.toUpperCase()}
                </span>
              </div>
            </div>

            {selectedHotspot.isRecurring && (
              <div className="my-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                <span>Recurring Complaint Zone: Multiple reports lodged within 250m.</span>
              </div>
            )}

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs">
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 dark:border-[#1E293B]">
                <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] uppercase block font-semibold">Total Complaints</span>
                <span className="text-base font-extrabold text-slate-900 dark:text-[#F8FAFC] font-mono">
                  {selectedHotspot.totalComplaints}
                </span>
              </div>
              <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                <span className="text-[10px] text-red-600 uppercase block font-semibold">Critical</span>
                <span className="text-base font-extrabold text-red-700 font-mono">
                  {selectedHotspot.priorityBreakdown.critical + selectedHotspot.priorityBreakdown.high}
                </span>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <span className="text-[10px] text-emerald-600 uppercase block font-semibold">Resolved</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono">
                  {selectedHotspot.statusBreakdown.resolved}
                </span>
              </div>
            </div>

            {/* Category Breakdown Tags */}
            <div className="mb-3">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                Category Distribution
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(selectedHotspot.categoryBreakdown).map(([cat, count]) => (
                  <span
                    key={cat}
                    className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 dark:border-[#1E293B] text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1]"
                  >
                    {cat.toUpperCase()}: <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Complaints List in this Hotspot */}
            <div className="mb-3">
              <span className="text-[11px] font-bold text-slate-600 dark:text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                Constituent Grievance Records ({selectedHotspot.complaints.length})
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {selectedHotspot.complaints.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (propIncidents && onSelectIncident) {
                        const raw = propIncidents.find((i) => i.id === c.id || i.incidentNumber === c.trackingNumber);
                        if (raw) onSelectIncident(raw);
                      }
                    }}
                    className="p-2 rounded-lg border border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#161F30] hover:bg-blue-50/50 dark:hover:bg-[#1E293B] transition-colors cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#0B4EA2] block">{c.trackingNumber}</span>
                      <span className="text-slate-600 dark:text-[#94A3B8] line-clamp-1 text-[11px]">{c.title}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <PriorityBadge priority={c.priority as any} size="sm" />
                      <StatusBadge status={c.status as any} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => zoomToHotspot(selectedHotspot.center.lat, selectedHotspot.center.lng)}
                className="flex-1 py-1.5 px-3 rounded-lg border border-[#CBD5E1] bg-white dark:bg-[#161F30] hover:bg-slate-50 dark:hover:bg-[#1E293B] text-slate-700 dark:text-[#CBD5E1] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ZoomIn size={13} />
                <span>Zoom In to Hotspot</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== B. SELECTED MARKER FLOATING CARD ==================== */}
        {selectedMarker && (
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-[#1E293B] max-w-sm w-full animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
              <span className="font-mono text-xs font-bold text-[#0B4EA2] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {selectedMarker.trackingNumber}
              </span>
              <div className="flex items-center gap-1.5">
                <PriorityBadge priority={selectedMarker.priority as any} size="sm" />
                <button
                  type="button"
                  onClick={() => setSelectedMarker(null)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 dark:text-[#CBD5E1]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <h4 className="font-bold text-sm text-slate-900 dark:text-[#F8FAFC] leading-snug mb-1">
              {selectedMarker.title}
            </h4>

            <p className="text-xs text-slate-500 dark:text-[#94A3B8] line-clamp-1 mb-2">
              {selectedMarker.location}
            </p>

            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 dark:border-[#1E293B] text-[11px] text-slate-600 dark:text-[#94A3B8] space-y-1 mb-3">
              <div className="flex items-center justify-between">
                <span>Category: <strong className="text-slate-800 dark:text-[#F8FAFC]">{selectedMarker.category}</strong></span>
                <StatusBadge status={selectedMarker.status as any} size="sm" />
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-[#94A3B8]">
                <span>Citizen: {selectedMarker.citizenName || "Verified"}</span>
                {selectedMarker.citizenMobile && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3 text-[#0B4EA2] shrink-0" /><span>{selectedMarker.citizenMobile}</span></span>}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (propIncidents && onSelectIncident) {
                  const raw = propIncidents.find(
                    (i) => i.id === selectedMarker.id || i.incidentNumber === selectedMarker.trackingNumber
                  );
                  if (raw) onSelectIncident(raw);
                }
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#0B4EA2] hover:bg-[#093e82] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span>View Complaint Redressal Dossier</span>
              <ExternalLink size={13} />
            </button>
          </div>
        )}

        {/* ==================== C. ADVANCED GEOSPATIAL FILTER DRAWER ==================== */}
        {showFilterDrawer && (
          <div className="absolute top-0 right-0 bottom-0 w-84 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md shadow-2xl border-l border-slate-200 dark:border-[#1E293B] p-5 z-30 overflow-y-auto animate-in slide-in-from-right duration-200 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={16} className="text-[#0B4EA2]" />
                <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] text-sm">Geospatial Filters</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterDrawer(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:text-[#CBD5E1]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Search Landmark or ID</label>
              <input
                type="text"
                placeholder="Search location, street, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-[#2D3748] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] text-xs"
              />
            </div>

            {/* Date Range Selector */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Date Period</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] font-medium text-xs"
              >
                <option value="all">All Recorded Complaints</option>
                <option value="today">Today Only</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {dateRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 dark:border-[#1E293B]">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-[#94A3B8] block mb-0.5">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-1.5 rounded border border-slate-300 dark:border-[#2D3748] text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-[#94A3B8] block mb-0.5">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-1.5 rounded border border-slate-300 dark:border-[#2D3748] text-[11px]"
                  />
                </div>
              </div>
            )}

            {/* Hotspot Intensity Filter */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Hotspot Intensity Filter</label>
              <select
                value={intensityFilter}
                onChange={(e) => setIntensityFilter(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] font-medium text-xs"
              >
                <option value="ALL">All Hotspot Intensities</option>
                <option value="CRITICAL">Critical Zones Only</option>
                <option value="HIGH_CRITICAL">High & Critical Zones</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Civic Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] font-medium text-xs"
              >
                <option value="ALL">All Categories</option>
                <option value="waste">Solid Waste / Garbage</option>
                <option value="water">Water Supply & Leakage</option>
                <option value="roads">Roads & Potholes</option>
                <option value="drainage">Drainage & Sewage</option>
                <option value="streetlights">Streetlight Malfunction</option>
                <option value="other">Other Civic Issues</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Priority Level</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] font-medium text-xs"
              >
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical / Urgent Priority</option>
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Resolution Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] font-medium text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNRESOLVED">Unresolved (Submitted / Active)</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved / Closed</option>
              </select>
            </div>

            {/* Division Filter */}
            <div>
              <label className="font-bold text-slate-700 dark:text-[#CBD5E1] block mb-1">Administrative Division</label>
              <select
                value={selectedDivisionId}
                onChange={(e) => setSelectedDivisionId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-[#2D3748] focus:outline-none focus:border-[#0B4EA2] dark:focus:border-[#3B82F6] bg-white dark:bg-[#161F30] text-slate-900 dark:text-[#F8FAFC] font-medium text-xs"
              >
                <option value="ALL">All Divisions (Maharashtra)</option>
                {INITIAL_DIVISIONS.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.name} Division
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            <button
              type="button"
              onClick={() => {
                setSelectedDivisionId("ALL");
                setSelectedDepartmentId("ALL");
                setSelectedCategory("ALL");
                setSelectedPriority("ALL");
                setSelectedStatus("ALL");
                setDateRange("all");
                setStartDate("");
                setEndDate("");
                setIntensityFilter("ALL");
                setShowUnresolvedOnly(false);
                setSearchQuery("");
              }}
              className="mt-auto py-2 px-3 rounded-lg border border-slate-300 dark:border-[#2D3748] hover:bg-slate-50 text-slate-700 dark:text-[#CBD5E1] font-bold transition-colors text-center"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* ==================== D. UNMAPPED COMPLAINTS DRAWER ==================== */}
        {showUnmappedDrawer && (
          <div className="absolute top-0 right-0 bottom-0 w-88 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md shadow-2xl border-l border-slate-200 dark:border-[#1E293B] p-5 z-30 overflow-y-auto animate-in slide-in-from-right duration-200 flex flex-col text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E293B] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] text-sm">Complaints Without GPS ({summary.totalUnmapped})</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowUnmappedDrawer(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 dark:text-[#CBD5E1]"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-slate-500 dark:text-[#94A3B8] text-[11px] mb-3">
              These complaints were logged with text-only addresses. As per policy, no fake coordinates are invented.
            </p>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {(geoData?.unmappedComplaints || []).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (propIncidents && onSelectIncident) {
                      const raw = propIncidents.find((i) => i.id === item.id || i.incidentNumber === item.trackingNumber);
                      if (raw) onSelectIncident(raw);
                    }
                  }}
                  className="p-3 rounded-xl border border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#161F30] hover:border-[#0B4EA2] dark:hover:border-[#3B82F6] transition-all cursor-pointer space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#0B4EA2]">{item.trackingNumber}</span>
                    <PriorityBadge priority={item.priority as any} size="sm" />
                  </div>
                  <h5 className="font-bold text-slate-800 dark:text-[#F8FAFC] text-xs">{item.title}</h5>
                  <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] flex items-center gap-1"><MapPin className="w-3 h-3 text-[#0B4EA2] shrink-0" /><span>{item.location}</span></p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>Citizen: {item.citizenName}</span>
                    <StatusBadge status={item.status as any} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== E. REGIONAL ANALYTICS MODAL ==================== */}
        {showRegionalModal && (
          <div className="absolute inset-0 z-30 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-[#111827] rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-[#1E293B] max-h-[500px] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1E293B] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-[#0B4EA2]" />
                  <h3 className="font-bold text-base text-slate-900 dark:text-[#F8FAFC]">Regional Complaint Intelligence & Volumes</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegionalModal(false)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 dark:text-[#CBD5E1]"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                {(geoData?.regionalAggregates || []).map((reg) => (
                  <div key={reg.regionName} className="p-4 rounded-xl border border-slate-200 dark:border-[#1E293B] bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-[#F8FAFC] text-sm">{reg.regionName}</h4>
                      <span className="text-slate-500 dark:text-[#94A3B8] text-[11px]">Primary Issue: <strong>{reg.dominantCategory.toUpperCase()}</strong></span>
                    </div>

                    <div className="flex items-center gap-4 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] uppercase block font-semibold">Total</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-[#F8FAFC]">{reg.totalComplaints}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-600 uppercase block font-semibold">Pending</span>
                        <span className="font-bold font-mono text-amber-700">{reg.pendingComplaints}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 uppercase block font-semibold">Resolved</span>
                        <span className="font-bold font-mono text-emerald-700">{reg.resolvedComplaints}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-blue-600 uppercase block font-semibold">Clearance</span>
                        <span className="font-bold font-mono text-blue-700">{reg.resolutionRate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== 4. FOOTER MAP LEGEND & ATTRIBUTION ==================== */}
      <div className="bg-slate-50 border-t border-slate-200 dark:border-[#1E293B] px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#94A3B8]">
        {/* Color Notations and Meaning */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Radio size={14} className="text-[#0B4EA2]" />
            <span>Small Radius Circles & Complaint Counts:</span>
          </span>

          {/* Critical */}
          <div className="flex items-center gap-1.5" title="Critical Zone: Multiple critical complaints or score >= 14">
            <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444]/30 border-2 border-[#DC2626] shadow-xs inline-block" />
            <span className="font-bold text-red-700 dark:text-red-400">Critical Risk Zone</span>
          </div>

          {/* High */}
          <div className="flex items-center gap-1.5" title="High Density: Elevated cluster volume or priority score >= 8">
            <span className="w-3.5 h-3.5 rounded-full bg-[#F97316]/30 border-2 border-[#EA580C] shadow-xs inline-block" />
            <span className="font-bold text-orange-700 dark:text-orange-400">High Density Hotspot</span>
          </div>

          {/* Moderate */}
          <div className="flex items-center gap-1.5" title="Moderate Concentration: Score >= 4 or recurring issue">
            <span className="w-3.5 h-3.5 rounded-full bg-[#F59E0B]/30 border-2 border-[#D97706] shadow-xs inline-block" />
            <span className="font-bold text-amber-700 dark:text-amber-400">Moderate Cluster</span>
          </div>

          {/* Low */}
          <div className="flex items-center gap-1.5" title="Routine / Low Priority cluster">
            <span className="w-3.5 h-3.5 rounded-full bg-[#3B82F6]/30 border-2 border-[#2563EB] shadow-xs inline-block" />
            <span className="font-bold text-blue-700 dark:text-blue-400">Routine / Low</span>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          {/* Pins Legend */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"/> Critical Pin
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"/> High Pin
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"/> Routine Pin
            </span>
          </div>
        </div>

        {/* Technical Notation Explanations */}
        <div className="text-slate-500 dark:text-[#94A3B8] text-[11px] flex items-center gap-2">
          <Info size={13} className="text-[#0B4EA2] shrink-0" />
          <span>Small radius circles (160m–280m) with complaint counts and on-map zone notations. Click any circle to inspect cluster records.</span>
        </div>
      </div>
    </div>
  );
}
