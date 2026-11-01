import { Router } from 'express';
import { AdminController } from './admin.controller';

const router = Router();
const controller = new AdminController();

// Officer & Department management for administrative onboarding
router.get('/departments', controller.getDepartments);
router.get('/officers', controller.getOfficers);
router.post('/officers', controller.addOfficer);
router.delete('/officers/:id', controller.deleteOfficer);
router.get('/stats/districts', controller.getDistrictStats);

export default router;

