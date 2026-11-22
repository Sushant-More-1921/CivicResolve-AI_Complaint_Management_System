import { Request, Response, NextFunction } from 'express';
import { MapsService } from './maps.service';
import { AuthRequest, normalizeRole } from '../../middleware/auth.middleware';
import { ROLES, resolveEffectiveDepartmentId } from '../../middleware/role.middleware';
import { z } from 'zod';

const mapsService = new MapsService();

const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const searchSchema = z.object({
  q: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(50).max(100000).default(2000),
});

export class MapsController {
  /**
   * GET /api/v1/maps/config
   * Returns MapTiler configuration securely from backend environment
   */
  public getConfig = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const config = mapsService.getConfig();
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/maps/reverse-geocode?lat=...&lng=...
   * Reverse geocodes coordinates to street / locality / address
   */
  public reverseGeocode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lng } = reverseGeocodeSchema.parse(req.query);
      const result = await mapsService.reverseGeocode(lat, lng);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/maps/search?q=...&lat=...&lng=...
   * Search places or landmarks
   */
  public searchPlaces = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, lat, lng } = searchSchema.parse(req.query);
      const results = await mapsService.searchPlaces(q, lat, lng);

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/maps/nearby?lat=...&lng=...&radius=...
   * PostGIS geospatial query finding nearby complaints within radius
   */
  public getNearbyComplaints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lat, lng, radius } = nearbySchema.parse(req.query);
      const list = await mapsService.getNearbyComplaints(lat, lng, radius);

      res.status(200).json({
        success: true,
        data: list,
        count: list.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/maps/geointelligence
   * Data-driven DBSCAN hotspot detection, priority regions, density calculation,
   * and spatial analytics from actual database complaints.
   */
  public getGeoIntelligence = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        divisionId,
        authorityId,
        departmentId,
        category,
        priority,
        status,
        dateRange,
        startDate,
        endDate,
        epsMeters,
        minPts,
      } = req.query;

      const effectiveDepartmentId = resolveEffectiveDepartmentId(
        req.user,
        departmentId ? String(departmentId) : undefined
      );
      const role = normalizeRole(req.user?.role);

      const data = await mapsService.getGeoIntelligence({
        divisionId: divisionId ? String(divisionId) : undefined,
        authorityId: authorityId ? String(authorityId) : undefined,
        departmentId: effectiveDepartmentId,
        assignedOfficerUserId: role === ROLES.OFFICER ? req.user?.id : undefined,
        assignedOfficerId: role === ROLES.OFFICER ? req.user?.officerId || undefined : undefined,
        category: category ? String(category) : undefined,
        priority: priority ? String(priority) : undefined,
        status: status ? String(status) : undefined,
        dateRange: dateRange ? String(dateRange) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        epsMeters: epsMeters ? Number(epsMeters) : undefined,
        minPts: minPts ? Number(minPts) : undefined,
      });

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
