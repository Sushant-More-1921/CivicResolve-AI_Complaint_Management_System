import { Router } from 'express';
import multer from 'multer';
import { OfficerController } from './officer.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
const controller = new OfficerController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authMiddleware);
router.use(requireRole(['OFFICER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']));

router.get('/dashboard', controller.getDashboardSummary);
router.get('/complaints', controller.getAssignedComplaints);
router.get('/field-workers', controller.getAvailableFieldWorkers);

router.get('/tasks', controller.getTasks);
router.post('/tasks', controller.createTask);
router.patch('/tasks/:id', controller.updateTask);

router.post('/complaints/:complaintId/evidence', upload.single('image'), controller.uploadEvidence);
router.patch('/evidence/:id/verify', controller.verifyEvidence);

export default router;

