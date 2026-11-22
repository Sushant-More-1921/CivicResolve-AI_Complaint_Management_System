import { env } from '../../config/env';
import { prisma } from '../../config/database';

export interface GeocodeResult {
  formattedAddress: string;
  placeName?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  latitude: number;
  longitude: number;
}

export class MapsService {
  /**
   * Return Mappls configuration from backend env
   */
  public getConfig() {
    const mapplsKey = env.MAPPLS_API_KEY?.trim() || '';
    return {
      mapplsApiKey: mapplsKey,
      hasKey: mapplsKey.length > 0,
      activeProvider: 'mappls',
      defaultCenter: [74.2232, 16.6946], // [lng, lat] Kolhapur City Center (on first appearance)
      defaultZoom: 13,
    };
  }

  /**
   * Reverse geocode coordinates to human-readable address.
   * Uses Mappls Geocoding API with OpenStreetMap Nominatim fallback.
   */
  public async reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
    const mapplsKey = env.MAPPLS_API_KEY?.trim();

    // 1. Try Mappls (MapmyIndia) Reverse Geocode if key is available
    if (mapplsKey) {
      try {
        const url = `https://search.mappls.com/search/address/rev-geocode?access_token=${encodeURIComponent(mapplsKey)}&lat=${latitude}&lng=${longitude}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'CivicResolve/1.0' } });
        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          if (!data) return null as any;
          const item = (data.results && data.results[0]) || data.response;
          if (item) {
            return {
              formattedAddress: item.formatted_address || item.address || `Location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
              placeName: item.poi || item.street || item.subLocality || item.locality,
              city: item.city || item.district || 'City',
              district: item.district || item.subDistrict || 'District',
              state: item.state || 'State',
              pincode: item.pincode,
              latitude,
              longitude,
            };
          }
        }
      } catch (err) {
        console.warn('Mappls reverse-geocode request failed, falling back:', err);
      }
    }

    // 2. Fallback to OpenStreetMap Nominatim (Free, public)
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CivicResolve-Grievance-Portal/1.0' },
      });
      if (res.ok) {
        const data: any = await res.json().catch(() => null);
        if (!data) return null as any;
        const addr = data.address || {};
        const road = addr.road || addr.suburb || addr.neighbourhood || addr.amenity || '';
        const city = addr.city || addr.town || addr.village || addr.municipality || 'Kolhapur';
        const district = addr.state_district || addr.county || 'Kolhapur District';
        const state = addr.state || 'Maharashtra';
        const postcode = addr.postcode;

        const parts = [road, city, district, state].filter(Boolean);
        const formattedAddress = data.display_name || (parts.length > 0 ? parts.join(', ') : `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`);

        return {
          formattedAddress,
          placeName: road || city,
          city,
          district,
          state,
          pincode: postcode,
          latitude,
          longitude,
        };
      }
    } catch (err) {
      console.warn('OSM reverse-geocode fallback failed:', err);
    }

    // Default coordinates fallback
    return {
      formattedAddress: `Location at ${latitude.toFixed(5)}° N, ${longitude.toFixed(5)}° E`,
      latitude,
      longitude,
    };
  }

  /**
   * Search places / landmarks
   * Prioritizes high-accuracy Indian street/village geocoding with coordinates,
   * with Mappls geocode integration.
   */
  public async searchPlaces(query: string, proximityLat?: number, proximityLng?: number) {
    if (!query || query.trim().length === 0) return [];
    const cleaned = query.trim();
    const results: Array<{ id: string; name: string; text: string; latitude: number; longitude: number }> = [];

    // 1. High-accuracy Indian Landmark & Street Geocoding via Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}&limit=6&countrycodes=in&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'CivicResolve-Grievance-Portal/1.0' } });
      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          for (const item of data) {
            const addr = item.address || {};
            const title = item.name || addr.road || addr.village || addr.town || addr.city || cleaned;
            const parts = [
              addr.road,
              addr.suburb || addr.neighbourhood,
              addr.village || addr.town || addr.city,
              addr.state_district || addr.county,
              addr.state,
              addr.postcode,
            ].filter(Boolean);
            const subtitle = parts.length > 0 ? parts.join(', ') : item.display_name;

            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            if (!isNaN(lat) && !isNaN(lon)) {
              results.push({
                id: item.place_id?.toString() || item.osm_id?.toString(),
                name: subtitle,
                text: title,
                latitude: lat,
                longitude: lon,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('OSM search error:', err);
    }

    if (results.length > 0) {
      return results;
    }

    // 2. Mappls Geocode fallback if OSM yields no hits and Mappls provides valid lat/lng
    const mapplsKey = env.MAPPLS_API_KEY?.trim();
    if (mapplsKey) {
      try {
        const url = `https://search.mappls.com/search/address/geocode?access_token=${encodeURIComponent(mapplsKey)}&address=${encodeURIComponent(cleaned)}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'CivicResolve/1.0' } });
        if (res.ok) {
          const data: any = await res.json();
          if (data && data.copResults) {
            const list = Array.isArray(data.copResults) ? data.copResults : [data.copResults];
            for (let idx = 0; idx < list.length; idx++) {
              const item = list[idx];
              const lat = parseFloat(item.latitude || item.lat);
              const lng = parseFloat(item.longitude || item.lng);
              if (!isNaN(lat) && !isNaN(lng)) {
                results.push({
                  id: item.eLoc || `mappls-${idx}`,
                  name: item.formattedAddress || cleaned,
                  text: item.poi || item.street || item.subLocality || item.locality || cleaned,
                  latitude: lat,
                  longitude: lng,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Mappls geocode search failed:', err);
      }
    }

    return results;
  }



  /**
   * PostGIS-Powered: Find nearby complaints within radius (in meters)
   * Uses ST_DWithin and ST_Distance on spatial points
   */
  public async getNearbyComplaints(latitude: number, longitude: number, radiusMeters: number = 2000) {
    try {
      // Ensure PostGIS distance calculation on WGS84 geography
      const query = `
        SELECT 
          id,
          "trackingNumber",
          title,
          description,
          category,
          priority,
          status,
          location,
          latitude,
          longitude,
          "createdAt",
          ROUND(
            ST_Distance(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )
          ) as distance_meters
        FROM "Complaint"
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
        ORDER BY distance_meters ASC
        LIMIT 50;
      `;

      const results: any[] = await prisma.$queryRawUnsafe(query, longitude, latitude, radiusMeters);

      return results.map((row) => ({
        id: row.id,
        trackingNumber: row.trackingNumber,
        title: row.title,
        description: row.description,
        category: row.category,
        priority: row.priority,
        status: row.status,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        createdAt: row.createdAt,
        distanceMeters: Number(row.distance_meters),
      }));
    } catch (error) {
      console.error('PostGIS nearby complaints query failed, using math fallback:', error);
      // Math fallback using Haversine if PostGIS query fails
      return this.haversineFallback(latitude, longitude, radiusMeters);
    }
  }

  /**
   * Comprehensive Geographic Intelligence & Hotspot Calculation
   * Evaluates real database complaints using DBSCAN density clustering,
   * priority risk scoring, and multi-tier spatial aggregation.
   */
  public async getGeoIntelligence(filters: {
    divisionId?: string;
    authorityId?: string;
    departmentId?: string;
    assignedOfficerUserId?: string;
    assignedOfficerId?: string;
    category?: string;
    priority?: string;
    status?: string;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    epsMeters?: number;
    minPts?: number;
  }) {
    const where: any = {};

    // 0. Officer assignment lock if requested (enforced for OFFICER role)
    if (filters.assignedOfficerUserId || filters.assignedOfficerId) {
      const officerOr: any[] = [];
      if (filters.assignedOfficerUserId) {
        officerOr.push({ assignedOfficerUserId: filters.assignedOfficerUserId });
      }
      if (filters.assignedOfficerId) {
        officerOr.push({ assignedOfficerId: filters.assignedOfficerId });
      }
      where.OR = officerOr;
    }

    // 1. Division filter
    if (filters.divisionId && filters.divisionId !== 'ALL') {
      where.divisionId = filters.divisionId;
    }

    // 2. Local Authority filter
    if (filters.authorityId && filters.authorityId !== 'ALL') {
      where.authorityId = filters.authorityId;
    }

    // 3. Department filter
    if (filters.departmentId && filters.departmentId !== 'ALL') {
      where.departmentId = filters.departmentId;
    }

    // 4. Category filter
    if (filters.category && filters.category !== 'ALL') {
      where.category = {
        equals: filters.category,
        mode: 'insensitive',
      };
    }

    // 5. Priority filter
    if (filters.priority && filters.priority !== 'ALL') {
      if (filters.priority === 'CRITICAL' || filters.priority === 'VERY_HIGH') {
        where.priority = { in: ['CRITICAL', 'VERY_HIGH', 'URGENT'] };
      } else {
        where.priority = filters.priority;
      }
    }

    // 6. Status filter
    if (filters.status && filters.status !== 'ALL') {
      if (filters.status === 'UNRESOLVED' || filters.status === 'PENDING') {
        where.status = { in: ['SUBMITTED', 'ASSIGNED', 'VALIDATING', 'IN_PROGRESS'] };
      } else if (filters.status === 'RESOLVED') {
        where.status = { in: ['RESOLVED', 'CLOSED'] };
      } else {
        where.status = filters.status;
      }
    }

    // 7. Date Range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      if (filters.dateRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.createdAt = { gte: startOfDay };
      } else if (filters.dateRange === '7d') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.createdAt = { gte: sevenDaysAgo };
      } else if (filters.dateRange === '30d') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        where.createdAt = { gte: thirtyDaysAgo };
      } else if (filters.dateRange === 'custom' && (filters.startDate || filters.endDate)) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
        if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const allComplaints = await prisma.complaint.findMany({
      where,
      include: {
        citizen: { select: { name: true, phoneNumber: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedComplaints: any[] = [];
    const unmappedComplaints: any[] = [];

    allComplaints.forEach((c) => {
      if (
        c.latitude != null &&
        c.longitude != null &&
        !isNaN(Number(c.latitude)) &&
        !isNaN(Number(c.longitude)) &&
        Number(c.latitude) !== 0 &&
        Number(c.longitude) !== 0
      ) {
        mappedComplaints.push(c);
      } else {
        unmappedComplaints.push({
          id: c.id,
          trackingNumber: c.trackingNumber,
          title: c.title,
          category: c.category,
          priority: c.priority,
          status: c.status,
          location: c.location,
          createdAt: c.createdAt.toISOString(),
          citizenName: c.citizen?.name || 'Verified Citizen',
        });
      }
    });

    // Run DBSCAN Spatial Clustering on Mapped Complaints
    const eps = Number(filters.epsMeters) || 800; // 800 meters default radius
    const minPts = Number(filters.minPts) || 1; // min 1 point for hotspot generation

    const toRad = (x: number) => (x * Math.PI) / 180;
    const haversineDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    const visited = new Set<string>();
    const clusteredIds = new Set<string>();
    const rawClusters: any[][] = [];

    for (let i = 0; i < mappedComplaints.length; i++) {
      const p = mappedComplaints[i];
      if (visited.has(p.id)) continue;
      visited.add(p.id);

      const neighbors: any[] = [];
      for (let j = 0; j < mappedComplaints.length; j++) {
        const other = mappedComplaints[j];
        const dist = haversineDist(Number(p.latitude), Number(p.longitude), Number(other.latitude), Number(other.longitude));
        if (dist <= eps) {
          neighbors.push(other);
        }
      }

      if (neighbors.length >= minPts) {
        const currentCluster = [p];
        clusteredIds.add(p.id);
        const queue = [...neighbors.filter((n) => n.id !== p.id)];

        while (queue.length > 0) {
          const q = queue.shift()!;
          if (!visited.has(q.id)) {
            visited.add(q.id);
            const qNeighbors = mappedComplaints.filter(
              (o) => haversineDist(Number(q.latitude), Number(q.longitude), Number(o.latitude), Number(o.longitude)) <= eps
            );
            if (qNeighbors.length >= minPts) {
              for (const qn of qNeighbors) {
                if (!queue.some((item) => item.id === qn.id) && !clusteredIds.has(qn.id)) {
                  queue.push(qn);
                }
              }
            }
          }
          if (!clusteredIds.has(q.id)) {
            clusteredIds.add(q.id);
            currentCluster.push(q);
          }
        }
        rawClusters.push(currentCluster);
      }
    }

    // Isolated / standalone high-priority complaints that form single-incident alert zones
    mappedComplaints.forEach((p) => {
      if (!clusteredIds.has(p.id)) {
        const isHighOrCritical = p.priority === 'HIGH' || p.priority === 'VERY_HIGH' || p.priority === 'CRITICAL' || p.priority === 'URGENT';
        const isUnresolved = p.status !== 'RESOLVED' && p.status !== 'CLOSED';
        // Form a standalone hotspot if it is high priority & unresolved
        if (isHighOrCritical && isUnresolved) {
          rawClusters.push([p]);
        }
      }
    });

    // Transform raw clusters into Hotspot objects with comprehensive analytics
    const hotspots = rawClusters.map((cluster, idx) => {
      const totalComplaints = cluster.length;
      const avgLat = cluster.reduce((sum, item) => sum + Number(item.latitude), 0) / totalComplaints;
      const avgLng = cluster.reduce((sum, item) => sum + Number(item.longitude), 0) / totalComplaints;

      let maxDist = 200;
      cluster.forEach((item) => {
        const dist = haversineDist(avgLat, avgLng, Number(item.latitude), Number(item.longitude));
        if (dist > maxDist) maxDist = dist;
      });

      const priorityBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };
      const statusBreakdown = { pending: 0, inProgress: 0, resolved: 0, rejected: 0 };
      const categoryBreakdown: Record<string, number> = {};

      let overdueCount = 0;
      let recurringCount = 0;

      cluster.forEach((c) => {
        // Priority
        if (c.priority === 'VERY_HIGH' || c.priority === 'CRITICAL' || c.priority === 'URGENT') {
          priorityBreakdown.critical++;
        } else if (c.priority === 'HIGH') {
          priorityBreakdown.high++;
        } else if (c.priority === 'LOW') {
          priorityBreakdown.low++;
        } else {
          priorityBreakdown.medium++;
        }

        // Status
        if (c.status === 'SUBMITTED' || c.status === 'ASSIGNED' || c.status === 'VALIDATING') {
          statusBreakdown.pending++;
        } else if (c.status === 'IN_PROGRESS') {
          statusBreakdown.inProgress++;
        } else if (c.status === 'RESOLVED' || c.status === 'CLOSED') {
          statusBreakdown.resolved++;
        } else if (c.status === 'REJECTED') {
          statusBreakdown.rejected++;
        }

        // Category
        const catKey = (c.category || 'other').toLowerCase();
        categoryBreakdown[catKey] = (categoryBreakdown[catKey] || 0) + 1;

        if (c.isOverdue) overdueCount++;
      });

      // Detect recurring patterns (multiple complaints within 250m or identical location strings)
      if (cluster.length >= 2) {
        for (let i = 0; i < cluster.length; i++) {
          for (let j = i + 1; j < cluster.length; j++) {
            const d = haversineDist(
              Number(cluster[i].latitude),
              Number(cluster[i].longitude),
              Number(cluster[j].latitude),
              Number(cluster[j].longitude)
            );
            if (d <= 250 || cluster[i].location.toLowerCase() === cluster[j].location.toLowerCase()) {
              recurringCount++;
              break;
            }
          }
        }
      }

      const unresolvedCount = statusBreakdown.pending + statusBreakdown.inProgress;

      // Documented Priority Score Formula:
      // (Density * 2) + (Critical * 4) + (High * 2) + (Unresolved * 3) + (Overdue * 3)
      const priorityScore =
        totalComplaints * 2 +
        priorityBreakdown.critical * 4 +
        priorityBreakdown.high * 2 +
        unresolvedCount * 3 +
        overdueCount * 3;

      let intensity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
      let attentionZone: 'CRITICAL_ATTENTION' | 'HIGH_ATTENTION' | 'NORMAL' = 'NORMAL';

      if (priorityScore >= 14 || priorityBreakdown.critical >= 2) {
        intensity = 'CRITICAL';
        attentionZone = 'CRITICAL_ATTENTION';
      } else if (priorityScore >= 8 || priorityBreakdown.critical >= 1 || priorityBreakdown.high >= 2) {
        intensity = 'HIGH';
        attentionZone = 'HIGH_ATTENTION';
      } else if (priorityScore >= 4 || totalComplaints >= 2) {
        intensity = 'MODERATE';
        attentionZone = 'NORMAL';
      }

      // Dominant Category & Priority
      let dominantCategory = 'Civic Issue';
      let maxCatCount = 0;
      Object.entries(categoryBreakdown).forEach(([cat, count]) => {
        if (count > maxCatCount) {
          maxCatCount = count;
          dominantCategory = cat;
        }
      });

      const dominantPriority =
        priorityBreakdown.critical > 0
          ? 'VERY_HIGH'
          : priorityBreakdown.high > 0
          ? 'HIGH'
          : priorityBreakdown.medium > 0
          ? 'MEDIUM'
          : 'LOW';

      const locationLabel = cluster[0]?.location?.split(',')[0] || cluster[0]?.districtName || 'Maharashtra Area';
      const resolutionRate = totalComplaints > 0 ? Math.round((statusBreakdown.resolved / totalComplaints) * 100) : 0;

      // Calculate compact municipal hotspot region radius (small radius circle)
      const compactRadius =
        intensity === 'CRITICAL' ? 300 :
        intensity === 'HIGH' ? 250 :
        intensity === 'MODERATE' ? 200 : 150;
      const radiusMeters = Math.min(500, Math.max(compactRadius, Math.round(maxDist + 50)));

      return {
        id: `hotspot-${idx + 1}-${cluster[0]?.id?.slice(0, 8)}`,
        name: `${locationLabel} (${dominantCategory.toUpperCase()}) Hotspot`,
        center: { lat: avgLat, lng: avgLng },
        radiusMeters,
        intensity,
        priorityScore,
        attentionZone,
        totalComplaints,
        priorityBreakdown,
        statusBreakdown,
        categoryBreakdown,
        dominantCategory,
        dominantPriority,
        isRecurring: recurringCount > 0,
        unresolvedCount,
        overdueCount,
        resolutionRate,
        latestComplaintDate: cluster[0]?.createdAt?.toISOString() || new Date().toISOString(),
        complaints: cluster.map((c) => ({
          id: c.id,
          trackingNumber: c.trackingNumber,
          title: c.title,
          category: c.category,
          priority: c.priority,
          status: c.status,
          location: c.location,
          createdAt: c.createdAt.toISOString(),
          latitude: Number(c.latitude),
          longitude: Number(c.longitude),
          citizenName: c.citizen?.name || 'Verified Citizen',
          citizenMobile: c.citizen?.phoneNumber,
          assignedOfficerName: c.assignedOfficerName || undefined,
        })),
      };
    });

    // Individual marker items for all mapped complaints
    const individualMarkers = mappedComplaints.map((c) => ({
      id: c.id,
      trackingNumber: c.trackingNumber,
      title: c.title,
      category: c.category,
      priority: c.priority,
      status: c.status,
      location: c.location,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      createdAt: c.createdAt.toISOString(),
      isOverdue: Boolean(c.isOverdue),
      citizenName: c.citizen?.name || 'Verified Citizen',
      citizenMobile: c.citizen?.phoneNumber,
      assignedOfficerName: c.assignedOfficerName || undefined,
    }));

    // Regional Aggregates (grouped by divisionName or districtName)
    const regionalMap = new Map<string, any>();
    allComplaints.forEach((c) => {
      const region = c.districtName || c.divisionName || 'Other Maharashtra Region';
      if (!regionalMap.has(region)) {
        regionalMap.set(region, {
          regionName: region,
          divisionId: c.divisionId,
          totalComplaints: 0,
          pendingComplaints: 0,
          inProgressComplaints: 0,
          resolvedComplaints: 0,
          criticalComplaints: 0,
          categories: {},
        });
      }
      const reg = regionalMap.get(region);
      reg.totalComplaints++;
      if (c.status === 'SUBMITTED' || c.status === 'ASSIGNED' || c.status === 'VALIDATING') {
        reg.pendingComplaints++;
      } else if (c.status === 'IN_PROGRESS') {
        reg.inProgressComplaints++;
      } else if (c.status === 'RESOLVED' || c.status === 'CLOSED') {
        reg.resolvedComplaints++;
      }
      if (c.priority === 'VERY_HIGH' || c.priority === 'CRITICAL' || c.priority === 'HIGH') {
        reg.criticalComplaints++;
      }
      const catKey = (c.category || 'other').toLowerCase();
      reg.categories[catKey] = (reg.categories[catKey] || 0) + 1;
    });

    const regionalAggregates = Array.from(regionalMap.values()).map((r) => {
      let dominantCategory = 'General';
      let maxCount = 0;
      Object.entries(r.categories).forEach(([cat, count]: [string, any]) => {
        if (count > maxCount) {
          maxCount = count;
          dominantCategory = cat;
        }
      });
      return {
        regionName: r.regionName,
        divisionId: r.divisionId,
        totalComplaints: r.totalComplaints,
        pendingComplaints: r.pendingComplaints,
        inProgressComplaints: r.inProgressComplaints,
        resolvedComplaints: r.resolvedComplaints,
        criticalComplaints: r.criticalComplaints,
        resolutionRate: r.totalComplaints > 0 ? Math.round((r.resolvedComplaints / r.totalComplaints) * 100) : 0,
        dominantCategory,
      };
    });

    // Calculate Summary KPIs
    const totalComplaints = allComplaints.length;
    const totalMapped = mappedComplaints.length;
    const totalUnmapped = unmappedComplaints.length;
    const totalHotspots = hotspots.length;
    const criticalHotspots = hotspots.filter((h) => h.intensity === 'CRITICAL').length;
    const highHotspots = hotspots.filter((h) => h.intensity === 'HIGH').length;
    const unresolvedComplaints = allComplaints.filter(
      (c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED' && c.status !== 'REJECTED'
    ).length;
    const criticalComplaints = allComplaints.filter(
      (c) => c.priority === 'CRITICAL' || c.priority === 'VERY_HIGH' || c.priority === 'HIGH'
    ).length;
    const totalResolved = allComplaints.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
    const resolutionRate = totalComplaints > 0 ? Math.round((totalResolved / totalComplaints) * 100) : 0;

    return {
      summary: {
        totalComplaints,
        totalMapped,
        totalUnmapped,
        totalHotspots,
        criticalHotspots,
        highHotspots,
        unresolvedComplaints,
        criticalComplaints,
        resolutionRate,
      },
      hotspots,
      individualMarkers,
      regionalAggregates,
      unmappedComplaints,
    };
  }

  /**
   * Fallback using Haversine formula if PostGIS table schema has unexpected types
   */
  private async haversineFallback(latitude: number, longitude: number, radiusMeters: number) {
    const complaints = await prisma.complaint.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        trackingNumber: true,
        title: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        location: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
      take: 200,
    });

    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters

    const nearby = complaints
      .map((c) => {
        const dLat = toRad((c.latitude as number) - latitude);
        const dLon = toRad((c.longitude as number) - longitude);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(latitude)) *
            Math.cos(toRad(c.latitude as number)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const distanceMeters = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        return { ...c, distanceMeters };
      })
      .filter((c) => c.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return nearby;
  }
}
