import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../config/database';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  district: z.string().optional(),
  ward: z.string().optional(),
  address: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits').optional().or(z.literal('')),
  avatarUrl: z.string().optional().or(z.literal('')),
  websiteNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  notifyStatusChange: z.boolean().optional(),
  notifyResolution: z.boolean().optional(),
  notifyInfoRequest: z.boolean().optional(),
});

export class UserController {
  /**
   * Get authenticated user profile
   */
  public getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          designation: true,
          district: true,
          ward: true,
          address: true,
          pincode: true,
          avatarUrl: true,
          departmentId: true,
          isActive: true,
          websiteNotifications: true,
          smsNotifications: true,
          notifyStatusChange: true,
          notifyResolution: true,
          notifyInfoRequest: true,
          department: { select: { id: true, name: true, code: true } },
          officerProfile: { select: { id: true, badgeId: true, departmentId: true } },
          createdAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User profile not found',
          error: { code: 'USER_NOT_FOUND' },
        });
      }

      const canonicalRole = user.role === 'ADMIN' ? 'DEPARTMENT_ADMIN' : user.role;
      const profileCompleted = !!(user.name && user.name !== 'Verified Citizen' && user.address);

      res.status(200).json({
        success: true,
        message: 'Profile fetched successfully',
        data: {
          ...user,
          role: canonicalRole,
          departmentId: user.departmentId || user.officerProfile?.departmentId || null,
          departmentName: user.department?.name || null,
          officerId: user.officerProfile?.id || null,
          badgeId: user.officerProfile?.badgeId || null,
          profileCompleted,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update authenticated user profile details (Name, Address, Ward, Pincode, Email)
   */
  public updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const data = updateProfileSchema.parse(req.body);

      const updatePayload: Record<string, any> = {};
      if (data.name !== undefined) updatePayload.name = data.name.trim();
      if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim() : null;
      if (data.district !== undefined) updatePayload.district = data.district.trim();
      if (data.ward !== undefined) updatePayload.ward = data.ward.trim();
      if (data.address !== undefined) updatePayload.address = data.address.trim();
      if (data.pincode !== undefined) updatePayload.pincode = data.pincode ? data.pincode.trim() : null;
      if (data.avatarUrl !== undefined) updatePayload.avatarUrl = data.avatarUrl || null;
      if (data.websiteNotifications !== undefined) updatePayload.websiteNotifications = data.websiteNotifications;
      if (data.smsNotifications !== undefined) updatePayload.smsNotifications = data.smsNotifications;
      if (data.notifyStatusChange !== undefined) updatePayload.notifyStatusChange = data.notifyStatusChange;
      if (data.notifyResolution !== undefined) updatePayload.notifyResolution = data.notifyResolution;
      if (data.notifyInfoRequest !== undefined) updatePayload.notifyInfoRequest = data.notifyInfoRequest;

      const user = await prisma.user.update({
        where: { id: userId },
        data: updatePayload,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          district: true,
          ward: true,
          address: true,
          pincode: true,
          avatarUrl: true,
          websiteNotifications: true,
          smsNotifications: true,
          notifyStatusChange: true,
          notifyResolution: true,
          notifyInfoRequest: true,
          updatedAt: true,
        },
      });

      const profileCompleted = !!(user.name && user.name !== 'Verified Citizen' && user.address);

      res.status(200).json({
        success: true,
        message: 'Citizen profile details saved successfully',
        data: {
          ...user,
          profileCompleted,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete Citizen Account permanently
   */
  public deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      if (req.user?.role && req.user.role !== 'CITIZEN') {
        return res.status(403).json({
          success: false,
          message: 'Administrative and officer accounts cannot be self-deleted via citizen portal.',
        });
      }

      // 1. Delete associated notifications
      await prisma.notification.deleteMany({
        where: { userId },
      });

      // 2. Delete user complaints and their cascaded timelines/attachments/feedback
      const userComplaints = await prisma.complaint.findMany({
        where: { citizenId: userId },
        select: { id: true },
      });

      const complaintIds = userComplaints.map((c) => c.id);
      if (complaintIds.length > 0) {
        await prisma.complaintTimeline.deleteMany({
          where: { complaintId: { in: complaintIds } },
        });
        await prisma.complaintAttachment.deleteMany({
          where: { complaintId: { in: complaintIds } },
        });
        await prisma.citizenFeedback.deleteMany({
          where: { complaintId: { in: complaintIds } },
        });
        await prisma.complaint.deleteMany({
          where: { id: { in: complaintIds } },
        });
      }

      // 3. Delete user account
      await prisma.user.delete({
        where: { id: userId },
      });

      res.status(200).json({
        success: true,
        message: 'Citizen account and associated records deleted permanently.',
      });
    } catch (error) {
      next(error);
    }
  };
}
