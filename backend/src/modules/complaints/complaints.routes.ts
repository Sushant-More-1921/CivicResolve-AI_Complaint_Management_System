import { Router } from 'express';
import { ComplaintsController } from './complaints.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { AIController } from '../ai/ai.controller';

const router = Router();
const controller = new ComplaintsController();
const aiController = new AIController();

// Real-time AI Complaint Description & Evidence Image Verification (Public / Citizen)
router.post('/verify-description', optionalAuthMiddleware, aiController.verifyComplaintDescription);
router.post('/validate-image', optionalAuthMiddleware, aiController.validateEvidenceImage);

// Public / Unauthenticated Tracking
router.get('/track/:trackingNumber', controller.getComplaintByTracking);

// Real-time AI Priority Prediction Endpoint
router.post('/predict-priority', optionalAuthMiddleware, aiController.predictPriority);

// Protected Citizen & Scoped Operational Routes
router.post('/', authMiddleware, requireRole(['CITIZEN']), controller.createComplaint);
router.get('/my', authMiddleware, requireRole(['CITIZEN']), controller.getMyComplaints);

// Protected Department Admin / Super Admin / Officer Management Routes
router.get(
  '/admin/stats',
  authMiddleware,
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.getAdminStats
);
router.get(
  '/',
  authMiddleware,
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER', 'CITIZEN']),
  controller.getAllComplaints
);
router.get('/:id', authMiddleware, controller.getComplaintById);
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.updateStatus
);
router.patch(
  '/:id/assign',
  authMiddleware,
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.assignOfficer
);
router.patch(
  '/:id/reassign-department',
  authMiddleware,
  requireRole(['SUPER_ADMIN']),
  controller.reassignDepartment
);
router.patch(
  '/:id/priority',
  authMiddleware,
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.overridePriority
);

export default router;
