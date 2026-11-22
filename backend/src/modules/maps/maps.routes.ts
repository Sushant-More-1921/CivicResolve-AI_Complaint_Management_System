import { Router } from 'express';
import { MapsController } from './maps.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
const controller = new MapsController();

// Public map config & address helpers for citizen form & portal
router.get('/config', controller.getConfig);
router.get('/reverse-geocode', controller.reverseGeocode);
router.get('/search', controller.searchPlaces);
router.get('/nearby', optionalAuthMiddleware, controller.getNearbyComplaints);

// Department-isolated geo-intelligence & hotspots for Admins & Officers
router.get(
  '/geointelligence',
  authMiddleware,
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.getGeoIntelligence
);

export default router;
