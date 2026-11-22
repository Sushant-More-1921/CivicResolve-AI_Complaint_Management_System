import { Router } from 'express';
import { AdminController } from './admin.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
const controller = new AdminController();

// 1. Departments listing (publicly viewable for civic directory; department-scoped if Dept Admin/Officer logged in)
router.get('/departments', optionalAuthMiddleware, controller.getDepartments);

// 2. Protected Authenticated Endpoints
router.use(authMiddleware);

// Department creation / updates / primary Department Admin lifecycle (SUPER_ADMIN ONLY)
router.post('/departments', requireRole(['SUPER_ADMIN']), controller.createDepartment);
router.patch('/departments/:id', requireRole(['SUPER_ADMIN']), controller.updateDepartment);
router.post(
  '/departments/:departmentId/replace-admin',
  requireRole(['SUPER_ADMIN']),
  (req, res, next) => {
    req.body = { ...req.body, replaceExisting: true };
    return controller.createOrAssignDepartmentAdmin(req, res, next);
  }
);
router.get('/department-admins', requireRole(['SUPER_ADMIN']), controller.getDepartmentAdmins);
router.post(
  '/department-admins',
  requireRole(['SUPER_ADMIN']),
  controller.createOrAssignDepartmentAdmin
);

// Officers Roster (SUPER_ADMIN, DEPARTMENT_ADMIN [own dept], OFFICER [own dept read-only])
router.get(
  '/officers',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.getOfficers
);
router.post(
  '/officers',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.addOfficer
);
router.patch(
  '/officers/:id',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.updateOfficer
);
router.delete(
  '/officers/:id',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.deleteOfficer
);

// Field Workers Registry (Employee records only — ZERO login/roles!)
router.get(
  '/field-workers',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.getFieldWorkers
);
router.post(
  '/field-workers',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.createFieldWorker
);
router.patch(
  '/field-workers/:id',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.updateFieldWorker
);
router.delete(
  '/field-workers/:id',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'OFFICER']),
  controller.deleteFieldWorker
);

// Analytics, District Stats & Audit Logs (Strictly scoped by role/department)
router.get(
  '/overview',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.getPlatformOverview
);
router.get(
  '/stats/districts',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.getDistrictStats
);
router.get(
  '/audit-logs',
  requireRole(['SUPER_ADMIN', 'DEPARTMENT_ADMIN']),
  controller.getAuditLogs
);

// Global User Governance (SUPER_ADMIN ONLY)
router.get('/users', requireRole(['SUPER_ADMIN']), controller.getUsers);
router.patch('/users/:id/role', requireRole(['SUPER_ADMIN']), controller.updateUserRole);
router.patch('/users/:id/status', requireRole(['SUPER_ADMIN']), controller.updateUserStatus);

export default router;
