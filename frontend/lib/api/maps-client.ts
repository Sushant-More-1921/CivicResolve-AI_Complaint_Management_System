import { getSessionToken } from "../auth/session";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const API_ROOT = API_BASE_URL.endsWith("/api/v1")
  ? API_BASE_URL
  : `${API_BASE_URL}/api/v1`;

export interface MapConfigData {
  mapplsApiKey: string;
  hasKey: boolean;
  maptilerApiKey?: string;
  hasMapplsKey?: boolean;
  activeProvider: "mappls";
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
}

export interface ReverseGeocodeData {
  formattedAddress: string;
  placeName?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  text: string;
  longitude: number;
  latitude: number;
}

export interface IpLocationData {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
  latitude: number;
  longitude: number;
  isp?: string;
}

export interface NearbyComplaint {
  id: string;
  trackingNumber: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  location: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  distanceMeters: number;
}

let cachedConfig: MapConfigData | null = null;

/**
 * Fetch Mappls configuration from backend env
 */
export async function getBackendMapConfig(): Promise<MapConfigData> {
  let localMapplsKey = "";
  if (typeof window !== "undefined") {
    localMapplsKey = localStorage.getItem("CIVICRESOLVE_MAPPLS_KEY") || "";
  }

  const clientMapplsKey = process.env.NEXT_PUBLIC_MAPPLS_API_KEY || "";

  try {
    const res = await fetch(`${API_ROOT}/maps/config`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.data) {
        cachedConfig = json.data;
        const effectiveMapplsKey = localMapplsKey || cachedConfig?.mapplsApiKey || clientMapplsKey;
        return {
          ...cachedConfig!,
          mapplsApiKey: effectiveMapplsKey,
          hasKey: Boolean(effectiveMapplsKey && effectiveMapplsKey.trim().length > 0),
          activeProvider: "mappls",
        };
      }
    }
  } catch (err) {
    console.warn("Could not fetch map config from backend:", err);
  }

  const mappls = localMapplsKey || clientMapplsKey;
  return {
    mapplsApiKey: mappls,
    hasKey: Boolean(mappls && mappls.trim().length > 0),
    activeProvider: "mappls",
    defaultCenter: [74.2433, 16.7050],
    defaultZoom: 13,
  };
}

/**
 * Reverse geocode coordinate through backend MapTiler/OSM service
 */
export async function reverseGeocodeCoords(lat: number, lng: number): Promise<ReverseGeocodeData | null> {
  try {
    const res = await fetch(`${API_ROOT}/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn("Reverse geocode failed:", err);
  }
  return null;
}

/**
 * Search places and landmarks through backend
 */
export async function searchPlacesApi(query: string, lat?: number, lng?: number): Promise<PlaceSearchResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    let url = `${API_ROOT}/maps/search?q=${encodeURIComponent(query.trim())}`;
    if (lat != null && lng != null) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success) return json.data;
    }
  } catch (err) {
    console.warn("Place search failed:", err);
  }
  return [];
}

/**
 * PostGIS spatial search for nearby reported issues
 */
export async function getNearbyComplaintsApi(lat: number, lng: number, radiusMeters: number = 2000): Promise<NearbyComplaint[]> {
  try {
    const res = await fetch(`${API_ROOT}/maps/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && Array.isArray(json.data)) return json.data;
    }
  } catch (err) {
    console.warn("Nearby complaints query failed:", err);
  }
  return [];
}

/**
 * Approximate geolocation via Client Public IP Address
 * Falls back cleanly from backend endpoint to direct ipwho.is
 */
export async function getIpLocationApi(): Promise<IpLocationData | null> {
  // 1. Backend proxy endpoint
  try {
    const res = await fetch(`${API_ROOT}/maps/ip-location`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("Backend IP location lookup failed, trying fallback:", err);
  }

  // 2. Direct client-side public IP fallback
  try {
    const res = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== false && data.latitude && data.longitude) {
        return {
          ip: data.ip,
          city: data.city,
          region: data.region,
          country: data.country,
          postal: data.postal,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          isp: data.connection?.isp || data.connection?.org,
        };
      }
    }
  } catch (err) {
    console.warn("Direct IP location lookup failed:", err);
  }

  return null;
}

export interface GeoIntelligenceSummary {
  totalComplaints: number;
  totalMapped: number;
  totalUnmapped: number;
  totalHotspots: number;
  criticalHotspots: number;
  highHotspots: number;
  unresolvedComplaints: number;
  criticalComplaints: number;
  resolutionRate: number;
}

export interface HotspotData {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  intensity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  priorityScore: number;
  attentionZone: "CRITICAL_ATTENTION" | "HIGH_ATTENTION" | "NORMAL";
  totalComplaints: number;
  priorityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  statusBreakdown: {
    pending: number;
    inProgress: number;
    resolved: number;
    rejected: number;
  };
  categoryBreakdown: Record<string, number>;
  dominantCategory: string;
  dominantPriority: string;
  isRecurring: boolean;
  unresolvedCount: number;
  overdueCount: number;
  resolutionRate: number;
  latestComplaintDate: string;
  complaints: Array<{
    id: string;
    trackingNumber: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    location: string;
    createdAt: string;
    latitude: number;
    longitude: number;
    citizenName?: string;
    citizenMobile?: string;
    assignedOfficerName?: string;
  }>;
}

export interface MarkerPoint {
  id: string;
  trackingNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  location: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  isOverdue: boolean;
  citizenName?: string;
  citizenMobile?: string;
  assignedOfficerName?: string;
}

export interface RegionalAggregateData {
  regionName: string;
  divisionId?: string;
  totalComplaints: number;
  pendingComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  criticalComplaints: number;
  resolutionRate: number;
  dominantCategory: string;
}

export interface UnmappedComplaintData {
  id: string;
  trackingNumber: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  location: string;
  createdAt: string;
  citizenName?: string;
}

export interface GeoIntelligenceResult {
  summary: GeoIntelligenceSummary;
  hotspots: HotspotData[];
  individualMarkers: MarkerPoint[];
  regionalAggregates: RegionalAggregateData[];
  unmappedComplaints: UnmappedComplaintData[];
}

/**
 * Fetch server-calculated DBSCAN hotspots, priority zones, regional stats,
 * and geographic intelligence from live database complaints.
 */
export async function getGeoIntelligenceApi(params?: {
  divisionId?: string;
  authorityId?: string;
  departmentId?: string;
  category?: string;
  priority?: string;
  status?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  epsMeters?: number;
  minPts?: number;
}): Promise<GeoIntelligenceResult | null> {
  try {
    const search = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== "" && v !== "ALL") search.set(k, String(v));
      });
    }
    const query = search.toString();
    const url = `${API_ROOT}/maps/geointelligence${query ? `?${query}` : ""}`;
    const token = getSessionToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { cache: "no-store", headers });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.success && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.warn("Could not fetch geointelligence from backend:", err);
  }
  return null;
}
