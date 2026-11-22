import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { ComplaintsService } from './complaints.service';
import { z } from 'zod';

const complaintsService = new ComplaintsService();

const createComplaintSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().min(10, 'Complaint description must be at least 10 characters'),
    category: z.string().optional(),
    language: z.enum(['en', 'hi', 'mr']).optional(),
    subcategory: z.string().optional(),
    divisionId: z.string().optional(),
    divisionName: z.string().optional(),
    authorityId: z.string().optional(),
    authorityName: z.string().optional(),
    location: z.string().min(3).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    imageUrl: z.string().optional(),
    imageBase64: z.string().max(12_000_000).optional(),
    imageContentType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  })
  .refine(
    (data) =>
      (data.latitude === undefined) === (data.longitude === undefined) &&
      (data.imageBase64 === undefined) === (data.imageContentType === undefined),
    'Coordinates and image content type must be provided with their corresponding values'
  );

const updateStatusSchema = z.object({
  status: z.enum([
    'SUBMITTED',
    'UNDER_REVIEW',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED',
    'REJECTED',
  ]),
  rejectionReason: z.string().optional(),
  resolutionRemarks: z.string().optional(),
  resolutionImageUrl: z.string().optional(),
});

const assignOfficerSchema = z.object({
  officerId: z.string().min(1, 'Officer ID required'),
  officerName: z.string().optional(),
});

const reassignDepartmentSchema = z.object({
  departmentId: z.string().min(1, 'Target department ID is required'),
  reason: z.string().min(3, 'Transfer reason is required').max(500),
});

export class ComplaintsController {
  public createComplaint = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const data = createComplaintSchema.parse(req.body);
      const result = await complaintsService.createComplaint(req.user.id, data);

      res.status(201).json({
        success: true,
        message: 'Complaint submitted and routed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getMyComplaints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const list = await complaintsService.getCitizenComplaints(req.user.id);

      res.status(200).json({
        success: true,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  };

  public getComplaintByTracking = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const trackingNumber = String(req.params.trackingNumber);
      const result = await complaintsService.getComplaintByTrackingNumber(trackingNumber);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getComplaintById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const complaintId = String(req.params.id);
      const result = await complaintsService.getComplaintById(complaintId, req.user);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAllComplaints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const {
        status,
        priority,
        category,
        divisionId,
        authorityId,
        departmentId,
        search,
        dateFrom,
        dateTo,
      } = req.query;

      const list = await complaintsService.getAllComplaints(
        {
          status: status as string,
          priority: priority as string,
          category: category as string,
          divisionId: divisionId as string,
          authorityId: authorityId as string,
          departmentId: departmentId as string,
          search: search as string,
          dateFrom: dateFrom as string,
          dateTo: dateTo as string,
        },
        req.user
      );

      res.status(200).json({
        success: true,
        count: list.length,
        data: list,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const complaintId = String(req.params.id);
      const data = updateStatusSchema.parse(req.body);
      const result = await complaintsService.updateComplaintStatus(complaintId, data.status, {
        authUser: req.user,
        rejectionReason: data.rejectionReason,
        resolutionRemarks: data.resolutionRemarks,
        resolutionImageUrl: data.resolutionImageUrl,
      });

      res.status(200).json({
        success: true,
        message: `Complaint status updated to ${data.status}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public assignOfficer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const complaintId = String(req.params.id);
      const data = assignOfficerSchema.parse(req.body);
      const result = await complaintsService.assignOfficer(
        complaintId,
        data.officerId,
        data.officerName,
        req.user
      );

      res.status(200).json({
        success: true,
        message: `Assigned to Officer ${result.assignedOfficerName || data.officerId}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public reassignDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const complaintId = String(req.params.id);
      const data = reassignDepartmentSchema.parse(req.body);
      const result = await complaintsService.reassignDepartment(
        complaintId,
        data.departmentId,
        data.reason,
        req.user
      );

      res.status(200).json({
        success: true,
        message: `Complaint transferred to ${result.department?.name || 'target department'}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public overridePriority = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const complaintId = String(req.params.id);
      const schema = z.object({
        priority: z.string().min(1),
        reason: z.string().min(3, 'Reason for priority override is required').max(1000),
      });

      const data = schema.parse(req.body);
      const result = await complaintsService.overridePriority(
        complaintId,
        data.priority,
        data.reason,
        req.user
      );

      res.status(200).json({
        success: true,
        message: `Priority updated to ${result.priority}`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAdminStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      const departmentId = req.query.departmentId as string | undefined;
      const stats = await complaintsService.getAdminStats(req.user, departmentId);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };
}
