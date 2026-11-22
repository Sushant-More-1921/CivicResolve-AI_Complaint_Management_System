import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { getMyNotifications, markNotificationRead, clearAllNotifications } from '../notifications/notification.service';

const router = Router();
const userController = new UserController();

router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);
router.delete('/account', userController.deleteAccount);

router.get('/notifications', getMyNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.delete('/notifications', clearAllNotifications);

export default router;
