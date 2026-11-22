import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/users/user.routes';
import complaintRoutes from '../modules/complaints/complaints.routes';
import adminRoutes from '../modules/admin/admin.routes';
import officerRoutes from '../modules/officer/officer.routes';
import aiRoutes from '../modules/ai/ai.routes';
import mapsRoutes from '../modules/maps/maps.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/complaints', complaintRoutes);
router.use('/admin', adminRoutes);
router.use('/officer', officerRoutes);
router.use('/ai', aiRoutes);
router.use('/maps', mapsRoutes);

export default router;
