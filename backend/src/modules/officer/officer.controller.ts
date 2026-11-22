import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { AuthRequest, normalizeRole } from '../../middleware/auth.middleware';
import {
  ROLES,
  assertDepartmentAccess,
  resolveEffectiveDepartmentId,
} from '../../middleware/role.middleware';
import { aiService } from '../ai/ai.service';
import { recordAuditLog } from '../audit/audit.service';
import { createNotification } from '../notifications/notification.service';
import { z } from 'zod';

const createTaskSchema = z.object({
  complaintId: z.string().min(1, 'complaintId is required'),
  title: z.string().min(3, 'Task title must be at least 3 characters'),
  instructions: z.string().optional(),
  dueDate: z.string().optional(),
  workerIds: z.array(z.string().min(1)).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(3).optional(),
  instructions: z.string().optional(),
  progressNote: z.string().optional(),
  status: z.enum(['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  workerIds: z.array(z.string().min(1)).optional(),
});

const uploadEvidenceSchema = z.object({
  taskId: z.string().optional(),
  stage: z.enum(['BEFORE', 'IN_PROGRESS', 'AFTER']).default('AFTER'),
  fileUrl: z.string().optional(),
  imageBase64: z.string().max(12_000_000).optional(),
  imageContentType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  caption: z.string().optional(),
});

function assertOfficerOwnsOrAdmin(
  complaint: {
    departmentId?: string | null;
    assignedOfficerId?: string | null;
    assignedOfficerUserId?: string | null;
  },
  user: NonNullable<AuthRequest['user']>
): void {
  const role = normalizeRole(user.role);
  if (role === ROLES.SUPER_ADMIN) return;

  assertDepartmentAccess(user, complaint.departmentId);

  if (role === ROLES.OFFICER) {
    const owns =
      complaint.assignedOfficerUserId === user.id ||
      (user.officerId && complaint.assignedOfficerId === user.officerId);
    if (!owns) {
      const err: any = new Error(
        'Forbidden: Officers may only act on complaints directly assigned to them.'
      );
      err.statusCode = 403;
      throw err;
    }
  }
}

async function validateSameDeptActiveWorkers(
  workerIds: string[],
  departmentId: string | null | undefined
): Promise<string[]> {
  const uniqueIds = Array.from(new Set(workerIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  if (!departmentId) {
    const err: any = new Error('Complaint is not assigned to a department yet.');
    err.statusCode = 400;
    throw err;
  }

  const workers = await prisma.fieldWorker.findMany({
    where: { id: { in: uniqueIds } },
  });

  if (workers.length !== uniqueIds.length) {
    const err: any = new Error('One or more selected field workers do not exist.');
    err.statusCode = 404;
    throw err;
  }

  for (const worker of workers) {
    if (worker.departmentId !== departmentId) {
      const err: any = new Error(
        `Forbidden: Field worker "${worker.name}" belongs to another department.`
      );
      err.statusCode = 403;
      throw err;
    }
    if (worker.status !== 'ACTIVE') {
      const err: any = new Error(
        `Field worker "${worker.name}" is inactive and cannot be assigned.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  return uniqueIds;
}

export class OfficerController {
  public getDashboardSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const effectiveDeptId = resolveEffectiveDepartmentId(req.user);
      const role = normalizeRole(req.user.role);

      const complaintWhere: any = effectiveDeptId ? { departmentId: effectiveDeptId } : {};
      const taskWhere: any = effectiveDeptId ? { departmentId: effectiveDeptId } : {};

      if (role === ROLES.OFFICER) {
        const officerOr: any[] = [{ assignedOfficerUserId: req.user.id }];
        if (req.user.officerId) {
          officerOr.push({ assignedOfficerId: req.user.officerId });
        }
        complaintWhere.OR = officerOr;
        taskWhere.officerId = req.user.id;
      }

      const [assignedTotal, inProgress, resolved, activeTasks, availableWorkers, department] =
        await Promise.all([
          prisma.complaint.count({ where: complaintWhere }),
          prisma.complaint.count({
            where: { ...complaintWhere, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
          }),
          prisma.complaint.count({ where: { ...complaintWhere, status: 'RESOLVED' } }),
          prisma.task.count({
            where: { ...taskWhere, status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
          }),
          prisma.fieldWorker.count({
            where: {
              ...(effectiveDeptId ? { departmentId: effectiveDeptId } : {}),
              status: 'ACTIVE',
              availabilityStatus: 'AVAILABLE',
            },
          }),
          effectiveDeptId
            ? prisma.department.findUnique({
                where: { id: effectiveDeptId },
                select: { id: true, name: true, code: true },
              })
            : Promise.resolve(null),
        ]);

      res.status(200).json({
        success: true,
        data: {
          department,
          assignedTotal,
          inProgress,
          resolved,
          activeTasks,
          availableWorkers,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getAssignedComplaints = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const effectiveDeptId = resolveEffectiveDepartmentId(
        req.user,
        req.query.departmentId as string | undefined
      );
      const role = normalizeRole(req.user.role);
      const where: any = {};

      if (effectiveDeptId) {
        where.departmentId = effectiveDeptId;
      }

      if (role === ROLES.OFFICER) {
        const officerOr: any[] = [{ assignedOfficerUserId: req.user.id }];
        if (req.user.officerId) {
          officerOr.push({ assignedOfficerId: req.user.officerId });
        }
        where.OR = officerOr;
      }

      const complaints = await prisma.complaint.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          citizen: { select: { id: true, name: true, phoneNumber: true } },
          timeline: { orderBy: { createdAt: 'asc' } },
          tasks: {
            include: {
              workers: { include: { fieldWorker: true } },
              evidence: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          evidence: {
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        count: complaints.length,
        data: complaints,
      });
    } catch (error) {
      next(error);
    }
  };

  public getAvailableFieldWorkers = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const effectiveDeptId = resolveEffectiveDepartmentId(
        req.user,
        req.query.departmentId as string | undefined
      );

      const workers = await prisma.fieldWorker.findMany({
        where: {
          ...(effectiveDeptId ? { departmentId: effectiveDeptId } : {}),
          status: 'ACTIVE',
        },
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { taskAssignments: true } },
        },
        orderBy: [{ availabilityStatus: 'asc' }, { name: 'asc' }],
      });

      res.status(200).json({
        success: true,
        count: workers.length,
        data: workers,
      });
    } catch (error) {
      next(error);
    }
  };

  public getTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
      const effectiveDeptId = resolveEffectiveDepartmentId(
        req.user,
        req.query.departmentId as string | undefined
      );
      const role = normalizeRole(req.user.role);
      const complaintId = req.query.complaintId as string | undefined;

      const where: any = {};
      if (effectiveDeptId) where.departmentId = effectiveDeptId;
      if (complaintId) where.complaintId = complaintId;
      if (role === ROLES.OFFICER) {
        where.OR = [
          { officerId: req.user.id },
          ...(req.user.officerId
            ? [{ complaint: { assignedOfficerId: req.user.officerId } }]
            : []),
        ];
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          complaint: {
            select: {
              id: true,
              trackingNumber: true,
              title: true,
              category: true,
              priority: true,
              status: true,
              location: true,
            },
          },
          officer: { select: { id: true, name: true, phoneNumber: true, designation: true } },
          workers: { include: { fieldWorker: true } },
          evidence: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
      next(error);
    }
  };

  public createTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const data = createTaskSchema.parse(req.body);
      const complaint = await prisma.complaint.findUnique({
        where: { id: data.complaintId },
      });

      if (!complaint) {
        return res.status(404).json({ success: false, message: 'Complaint not found.' });
      }

      assertOfficerOwnsOrAdmin(complaint, req.user);

      if (!complaint.departmentId) {
        return res.status(400).json({
          success: false,
          message: 'Complaint must belong to a department before creating field tasks.',
        });
      }

      const validWorkerIds = await validateSameDeptActiveWorkers(
        data.workerIds,
        complaint.departmentId
      );

      const initialTaskStatus = validWorkerIds.length > 0 ? 'ASSIGNED' : 'PENDING';
      const taskOwnerId = complaint.assignedOfficerUserId || req.user.id;

      const task = await prisma.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: {
            complaintId: complaint.id,
            departmentId: complaint.departmentId!,
            officerId: taskOwnerId,
            createdById: req.user!.id,
            title: data.title.trim(),
            instructions: data.instructions?.trim() || null,
            status: initialTaskStatus,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            workers:
              validWorkerIds.length > 0
                ? {
                    create: validWorkerIds.map((fieldWorkerId) => ({ fieldWorkerId })),
                  }
                : undefined,
          },
          include: {
            workers: { include: { fieldWorker: true } },
            evidence: true,
            complaint: {
              select: { id: true, trackingNumber: true, title: true, status: true },
            },
          },
        });

        if (validWorkerIds.length > 0) {
          await tx.fieldWorker.updateMany({
            where: { id: { in: validWorkerIds } },
            data: { availabilityStatus: 'ON_TASK' },
          });
        }

        if (
          complaint.status === 'SUBMITTED' ||
          complaint.status === 'ASSIGNED' ||
          complaint.status === 'UNDER_REVIEW'
        ) {
          await tx.complaint.update({
            where: { id: complaint.id },
            data: { status: 'IN_PROGRESS' },
          });
        }

        const workerNames = created.workers.map((w) => w.fieldWorker.name).join(', ');
        await tx.complaintTimeline.create({
          data: {
            complaintId: complaint.id,
            status: 'IN_PROGRESS',
            actionType: 'TASK_CREATED',
            note: `Task "${created.title}" created${workerNames ? ` and assigned to field crew: ${workerNames}` : ''}.`,
            author: req.user!.name || req.user!.role,
            authorRole: req.user!.role,
          },
        });

        return created;
      });

      await recordAuditLog({
        actorId: req.user.id,
        actorName: req.user.name || req.user.role,
        actorRole: req.user.role,
        departmentId: complaint.departmentId,
        complaintId: complaint.id,
        action: 'CREATE_TASK',
        targetType: 'TASK',
        targetId: task.id,
        summary: `Created task "${task.title}" on ${complaint.trackingNumber} with ${validWorkerIds.length} field worker(s).`,
        metadata: { workerIds: validWorkerIds },
      });

      res.status(201).json({
        success: true,
        message: 'Field execution task created successfully.',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const taskId = String(req.params.id);
      const data = updateTaskSchema.parse(req.body);

      const existing = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          complaint: true,
          workers: true,
        },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Task not found.' });
      }

      assertOfficerOwnsOrAdmin(existing.complaint, req.user);

      let validWorkerIds: string[] | undefined;
      if (data.workerIds !== undefined) {
        validWorkerIds = await validateSameDeptActiveWorkers(data.workerIds, existing.departmentId);
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (validWorkerIds !== undefined) {
          await tx.taskWorker.deleteMany({ where: { taskId } });
          if (validWorkerIds.length > 0) {
            await tx.taskWorker.createMany({
              data: validWorkerIds.map((fieldWorkerId) => ({ taskId, fieldWorkerId })),
            });
            await tx.fieldWorker.updateMany({
              where: { id: { in: validWorkerIds } },
              data: { availabilityStatus: 'ON_TASK' },
            });
          }
        }

        const nextStatus = data.status || existing.status;
        const nextTask = await tx.task.update({
          where: { id: taskId },
          data: {
            ...(data.title !== undefined ? { title: data.title.trim() } : {}),
            ...(data.instructions !== undefined
              ? { instructions: data.instructions.trim() }
              : {}),
            ...(data.progressNote !== undefined
              ? { progressNote: data.progressNote.trim() }
              : {}),
            status: nextStatus,
            ...(nextStatus === 'IN_PROGRESS' && !existing.startedAt ? { startedAt: new Date() } : {}),
            ...(nextStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
          },
          include: {
            workers: { include: { fieldWorker: true } },
            evidence: true,
            complaint: { select: { id: true, trackingNumber: true, title: true } },
          },
        });

        // Release workers when task completes or cancels if they have no other open task
        if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED') {
          const workerIdsToCheck = nextTask.workers.map((w) => w.fieldWorkerId);
          for (const fwId of workerIdsToCheck) {
            const otherOpenCount = await tx.taskWorker.count({
              where: {
                fieldWorkerId: fwId,
                taskId: { not: taskId },
                task: { status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
              },
            });
            if (otherOpenCount === 0) {
              await tx.fieldWorker.update({
                where: { id: fwId },
                data: { availabilityStatus: 'AVAILABLE' },
              });
            }
          }
        }

        if (data.status || data.progressNote) {
          await tx.complaintTimeline.create({
            data: {
              complaintId: existing.complaintId,
              status: existing.complaint.status,
              actionType: 'TASK_UPDATED',
              note: `Task "${nextTask.title}" -> ${nextStatus}${data.progressNote ? `: ${data.progressNote.trim()}` : ''}`,
              author: req.user!.name || req.user!.role,
              authorRole: req.user!.role,
            },
          });
        }

        return nextTask;
      });

      await recordAuditLog({
        actorId: req.user.id,
        actorName: req.user.name || req.user.role,
        actorRole: req.user.role,
        departmentId: existing.departmentId,
        complaintId: existing.complaintId,
        action: 'UPDATE_TASK',
        targetType: 'TASK',
        targetId: taskId,
        summary: `Updated task "${updated.title}" -> ${updated.status}.`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  public uploadEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const complaintId = String(req.params.complaintId);
      const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        include: { citizen: { select: { id: true, phoneNumber: true } } },
      });

      if (!complaint) {
        return res.status(404).json({ success: false, message: 'Complaint not found.' });
      }

      assertOfficerOwnsOrAdmin(complaint, req.user);

      const parsed = uploadEvidenceSchema.parse(req.body || {});
      let finalFileUrl = parsed.fileUrl?.trim() || '';

      if (req.file) {
        const mime =
          req.file.mimetype === 'image/png' || req.file.mimetype === 'image/webp'
            ? req.file.mimetype
            : 'image/jpeg';
        const b64 = req.file.buffer.toString('base64');
        finalFileUrl = await aiService.uploadComplaintImage(b64, mime);
      } else if (parsed.imageBase64 && parsed.imageContentType) {
        finalFileUrl = await aiService.uploadComplaintImage(
          parsed.imageBase64,
          parsed.imageContentType
        );
      }

      if (!finalFileUrl) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an evidence image file, base64 image, or valid fileUrl.',
        });
      }

      if (parsed.taskId) {
        const task = await prisma.task.findUnique({ where: { id: parsed.taskId } });
        if (!task || task.complaintId !== complaintId) {
          return res.status(400).json({
            success: false,
            message: 'taskId does not belong to this complaint.',
          });
        }
      }

      const evidence = await prisma.evidence.create({
        data: {
          complaintId,
          taskId: parsed.taskId || null,
          uploadedByOfficerId: req.user.id,
          stage: parsed.stage,
          fileUrl: finalFileUrl,
          caption: parsed.caption?.trim() || null,
          verified: normalizeRole(req.user.role) !== ROLES.OFFICER,
          verifiedById: normalizeRole(req.user.role) !== ROLES.OFFICER ? req.user.id : null,
          verifiedAt: normalizeRole(req.user.role) !== ROLES.OFFICER ? new Date() : null,
        },
        include: {
          uploadedByOfficer: { select: { id: true, name: true, designation: true } },
        },
      });

      if (parsed.stage === 'AFTER') {
        await prisma.complaint.update({
          where: { id: complaintId },
          data: { resolutionImageUrl: finalFileUrl },
        });
      }

      await prisma.complaintTimeline.create({
        data: {
          complaintId,
          status: complaint.status,
          actionType: 'EVIDENCE_UPLOADED',
          note: `${parsed.stage} work evidence uploaded${parsed.caption ? `: ${parsed.caption.trim()}` : ''}.`,
          author: req.user.name || req.user.role,
          authorRole: req.user.role,
        },
      });

      await recordAuditLog({
        actorId: req.user.id,
        actorName: req.user.name || req.user.role,
        actorRole: req.user.role,
        departmentId: complaint.departmentId,
        complaintId,
        action: 'UPLOAD_EVIDENCE',
        targetType: 'EVIDENCE',
        targetId: evidence.id,
        summary: `Uploaded ${parsed.stage} evidence photo for ${complaint.trackingNumber}.`,
      });

      await createNotification({
        userId: complaint.citizenId,
        phoneNumber: complaint.citizen?.phoneNumber,
        title: `Field Evidence Uploaded (${complaint.trackingNumber})`,
        message: `${parsed.stage} inspection photo was uploaded by field officer.`,
        type: 'EVIDENCE_UPLOADED',
        link: `/complaints/track?id=${complaint.trackingNumber}`,
      });

      res.status(201).json({
        success: true,
        message: `${parsed.stage} photo evidence uploaded successfully.`,
        data: evidence,
      });
    } catch (error) {
      next(error);
    }
  };

  public verifyEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const id = String(req.params.id);
      const evidence = await prisma.evidence.findUnique({
        where: { id },
        include: { complaint: true },
      });

      if (!evidence) {
        return res.status(404).json({ success: false, message: 'Evidence record not found.' });
      }

      assertOfficerOwnsOrAdmin(evidence.complaint, req.user);

      const updated = await prisma.evidence.update({
        where: { id },
        data: {
          verified: true,
          verifiedById: req.user.id,
          verifiedAt: new Date(),
        },
      });

      await recordAuditLog({
        actorId: req.user.id,
        actorName: req.user.name || req.user.role,
        actorRole: req.user.role,
        departmentId: evidence.complaint.departmentId,
        complaintId: evidence.complaintId,
        action: 'VERIFY_EVIDENCE',
        targetType: 'EVIDENCE',
        targetId: id,
        summary: `Verified ${evidence.stage} evidence for ${evidence.complaint.trackingNumber}.`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}

