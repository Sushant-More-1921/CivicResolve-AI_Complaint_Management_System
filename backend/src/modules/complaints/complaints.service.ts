import { prisma } from '../../config/database';
import { randomUUID } from 'crypto';
import { AIAnalysis, AIComplaintContext, aiService } from '../ai/ai.service';
import {
  AuthUserContext,
  normalizeRole,
} from '../../middleware/auth.middleware';
import {
  ROLES,
  assertDepartmentAccess,
  resolveEffectiveDepartmentId,
} from '../../middleware/role.middleware';
import {
  normalizeCanonicalCategory,
  resolveDepartmentForCategory,
} from './department-routing';
import { recordAuditLog } from '../audit/audit.service';
import { createNotification } from '../notifications/notification.service';

export interface CreateComplaintInput {
  title?: string;
  description: string;
  category?: string;
  language?: 'en' | 'hi' | 'mr';
  subcategory?: string;
  divisionId?: string;
  divisionName?: string;
  authorityId?: string;
  authorityName?: string;
  departmentId?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  imageBase64?: string;
  imageContentType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const STANDARD_COMPLAINT_INCLUDE = {
  department: {
    select: {
      id: true,
      name: true,
      code: true,
      primaryAdminId: true,
    },
  },
  citizen: { select: { id: true, name: true, phoneNumber: true, email: true } },
  timeline: { orderBy: { createdAt: 'asc' as const } },
  attachments: true,
  feedback: true,
  tasks: {
    include: {
      workers: {
        include: {
          fieldWorker: true,
        },
      },
      evidence: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  evidence: {
    include: {
      uploadedByOfficer: {
        select: { id: true, name: true, phoneNumber: true, designation: true },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

// High-speed lean include for list views & dashboards (avoids heavy recursive joins)
const COMPLAINT_LIST_INCLUDE = {
  department: {
    select: {
      id: true,
      name: true,
      code: true,
      primaryAdminId: true,
    },
  },
  citizen: { select: { id: true, name: true, phoneNumber: true, email: true } },
  feedback: true,
  timeline: {
    select: {
      id: true,
      status: true,
      note: true,
      author: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
};

interface CachedEntry<T> {
  data: T;
  timestamp: number;
}
const statsCache = new Map<string, CachedEntry<any>>();
const complaintsCache = new Map<string, CachedEntry<any>>();
const CACHE_TTL_MS = 4000;

export function invalidateStatsCache(): void {
  statsCache.clear();
  complaintsCache.clear();
}

export class ComplaintsService {
  /**
   * Determine statutory SLA hours by priority and category
   */
  private getSlaHours(category: string, priority?: string): number {
    const cat = category.toLowerCase();
    if (cat.includes('hazard') || cat.includes('chemical') || cat.includes('bio')) return 2;
    if (priority === 'VERY_HIGH' || priority === 'CRITICAL' || priority?.toLowerCase() === 'critical') return 4;
    if (priority === 'HIGH' || priority?.toLowerCase() === 'high') return 12;
    if (priority === 'MEDIUM' || priority?.toLowerCase() === 'medium') return 24;
    if (priority === 'LOW' || priority?.toLowerCase() === 'low') return 48;
    return 24;
  }

  private isOfficerAssignedToComplaint(
    complaint: { assignedOfficerId?: string | null; assignedOfficerUserId?: string | null },
    user: AuthUserContext
  ): boolean {
    if (complaint.assignedOfficerUserId && complaint.assignedOfficerUserId === user.id) {
      return true;
    }
    if (user.officerId && complaint.assignedOfficerId === user.officerId) {
      return true;
    }
    return false;
  }

  private assertComplaintAccess(
    complaint: {
      citizenId: string;
      departmentId?: string | null;
      assignedOfficerId?: string | null;
      assignedOfficerUserId?: string | null;
    },
    user: AuthUserContext
  ): void {
    const role = normalizeRole(user.role);
    if (role === ROLES.SUPER_ADMIN) return;

    if (role === ROLES.CITIZEN) {
      if (complaint.citizenId !== user.id) {
        const err: any = new Error(
          "Forbidden: You do not have permission to access another citizen's complaint."
        );
        err.statusCode = 403;
        throw err;
      }
      return;
    }

    if (role === ROLES.DEPARTMENT_ADMIN) {
      assertDepartmentAccess(user, complaint.departmentId);
      return;
    }

    if (role === ROLES.OFFICER) {
      assertDepartmentAccess(user, complaint.departmentId);
      if (!this.isOfficerAssignedToComplaint(complaint, user)) {
        const err: any = new Error(
          'Forbidden: Officers can only access complaints assigned to them.'
        );
        err.statusCode = 403;
        throw err;
      }
      return;
    }

    const err: any = new Error('Forbidden: Insufficient permissions.');
    err.statusCode = 403;
    throw err;
  }

  /**
   * Create a new complaint lodged by authenticated citizen.
   * Department routing is STRICTLY derived server-side from category/AI prediction;
   * citizen-supplied departmentId overrides are never trusted.
   */
  public async createComplaint(userId: string, data: CreateComplaintInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      const error: any = new Error('Citizen user profile not found.');
      error.statusCode = 404;
      throw error;
    }

    const complaintId = randomUUID();
    const trackingNumber = `CMP-${new Date().getFullYear()}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 8)
      .toUpperCase()}`;

    const previousComplaints =
      data.latitude != null && data.longitude != null
        ? await prisma.complaint.findMany({
          where: {
            latitude: {
              gte: data.latitude - 0.05,
              lte: data.latitude + 0.05,
            },
            longitude: {
              gte: data.longitude - 0.05,
              lte: data.longitude + 0.05,
            },
            status: { in: ['SUBMITTED', 'IN_PROGRESS', 'UNDER_REVIEW', 'ASSIGNED'] },
          },
          select: {
            id: true,
            citizenId: true,
            description: true,
            latitude: true,
            longitude: true,
            category: true,
            issueClusterId: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        })
        : [];

    const complaintContext: AIComplaintContext[] = previousComplaints.flatMap((c) => {
      if (c.latitude == null || c.longitude == null) return [];
      return [
        {
          id: c.id,
          citizen_id: c.citizenId,
          text: c.description,
          latitude: c.latitude,
          longitude: c.longitude,
          category: c.category,
          issue_cluster_id: c.issueClusterId,
          created_at: c.createdAt.toISOString(),
          status: c.status,
        },
      ];
    });

    const clusterGroups = new Map<string, AIComplaintContext[]>();
    for (const c of complaintContext) {
      if (!c.issue_cluster_id) continue;
      const cluster = clusterGroups.get(c.issue_cluster_id) || [];
      cluster.push(c);
      clusterGroups.set(c.issue_cluster_id, cluster);
    }
    const issueClusters = Array.from(clusterGroups.entries()).map(([issueClusterId, list]) => ({
      issue_cluster_id: issueClusterId,
      category: list[0].category,
      location: {
        latitude: list[0].latitude,
        longitude: list[0].longitude,
      },
      report_count: list.length,
      unique_citizen_count: new Set(list.map((c) => c.citizen_id)).size,
    }));

    let imageValidation: Awaited<ReturnType<typeof aiService.validateImage>> | null = null;
    let imageResult: { image_description: string; analysis: AIAnalysis } | null = null;
    let imageUrl = data.imageUrl;

    if (data.imageBase64 && data.imageContentType) {
      // Parallelize image validation, AI captioning and Cloudinary/storage upload concurrently for speed
      const [valRes, imgRes, uploadedUrl] = await Promise.all([
        aiService.validateImage({
          imageBase64: data.imageBase64,
          contentType: data.imageContentType,
          category: data.category || '',
          description: data.description,
          language: data.language || 'auto',
        }).catch((err) => {
          console.warn('[AI Image Validation] Skipped:', err instanceof Error ? err.message : err);
          return null;
        }),
        aiService.analyzeImage({
          imageBase64: data.imageBase64,
          contentType: data.imageContentType,
          text: data.description,
          language: data.language,
        }).catch((err) => {
          console.warn('[AI Image Caption] Skipped:', err instanceof Error ? err.message : err);
          return null;
        }),
        aiService.uploadComplaintImage(data.imageBase64, data.imageContentType).catch(() => undefined),
      ]);

      imageValidation = valRes;
      imageResult = imgRes;
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      }

      if (imageValidation?.status === 'INVALID') {
        const err: any = new Error(
          'This image does not appear to show the reported civic issue. Please upload a clear photo of the problem.'
        );
        err.statusCode = 400;
        throw err;
      }

      if (imageValidation?.perceptual_hash) {
        aiService.recordSubmittedImageHash(imageValidation.perceptual_hash);
      }
    }

    const analysisText = imageResult
      ? `${data.description}\nVisible photo evidence: ${imageResult.image_description}`
      : data.description;

    const aiResult: AIAnalysis = await aiService.analyzeComplaint({
      text: analysisText,
      language: data.language,
      latitude: data.latitude,
      longitude: data.longitude,
      complaintId,
      citizenId: user.id,
      previousComplaints: complaintContext,
      issueClusters,
    });

    // Honor explicit non-'other' citizen selection; for generic 'Other', adopt AI prediction only when confident
    const rawSubmittedCategory = (data.category || '').trim();
    const isGenericOther =
      rawSubmittedCategory.length === 0 ||
      rawSubmittedCategory.toLowerCase() === 'other' ||
      rawSubmittedCategory.toLowerCase() === 'other civic issue';

    const effectiveRawCategory = !isGenericOther
      ? rawSubmittedCategory
      : !aiResult.manual_review && aiResult.category
        ? aiResult.category
        : rawSubmittedCategory || 'Other Civic Issue';

    const category = normalizeCanonicalCategory(effectiveRawCategory);
    const { department: resolvedDept } = await resolveDepartmentForCategory(category);
    const departmentId = resolvedDept?.id || undefined;

    const priority = this.mapPriority(aiResult.priority);
    const location =
      data.location ||
      (data.latitude != null && data.longitude != null
        ? `GPS ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`
        : 'Location not provided');
    const slaHours = this.getSlaHours(category, priority);
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    // Auto-assign lowest active workload officer strictly inside resolved department
    let assignedOfficerId: string | null = null;
    let assignedOfficerName: string | null = null;
    let assignedOfficerUserId: string | null = null;

    if (departmentId) {
      const availableOfficer = await prisma.officer.findFirst({
        where: {
          departmentId,
          isAvailable: true,
          OR: [{ userId: null }, { user: { isActive: true, role: 'OFFICER' } }],
        },
        orderBy: { activeCases: 'asc' },
        include: {
          user: { select: { id: true } },
        },
      });
      if (availableOfficer) {
        assignedOfficerId = availableOfficer.id;
        assignedOfficerName = availableOfficer.name;
        assignedOfficerUserId = availableOfficer.userId || availableOfficer.user?.id || null;
        await prisma.officer.update({
          where: { id: availableOfficer.id },
          data: { activeCases: { increment: 1 } },
        });
      }
    }

    const initialStatus = assignedOfficerId
      ? 'ASSIGNED'
      : aiResult.manual_review
        ? 'UNDER_REVIEW'
        : 'SUBMITTED';

    const complaint = await prisma.complaint.create({
      data: {
        id: complaintId,
        trackingNumber,
        title: data.title || `${category}: ${location}`,
        description: data.description,
        category,
        subcategory: data.subcategory,
        divisionId: data.divisionId || 'div-kolhapur',
        divisionName: data.divisionName || 'Kolhapur Division',
        districtId: 'dist-kolhapur',
        districtName: 'Kolhapur District',
        authorityId: data.authorityId || 'auth-kmc',
        authorityName: data.authorityName || 'Kolhapur Municipal Corporation (KMC)',
        departmentId,
        location,
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl,
        status: initialStatus,
        priority,
        citizenId: user.id,
        assignedOfficerId,
        assignedOfficerName,
        assignedOfficerUserId,
        slaHours,
        slaDeadline,
        aiConfidence: aiResult.priority_confidence || aiResult.category_confidence,
        aiSuggestedCategory: aiResult.category,
        aiReasoning: [
          this.createAiReasoning(aiResult),
          imageResult ? `Photo analysis: ${imageResult.image_description}` : null,
        ]
          .filter(Boolean)
          .join(' '),
        aiLanguage: aiResult.language,
        aiUrgencyScore: aiResult.severity_score,
        priorityModelVersion: aiResult.model_version || 'priority-v2.0.0',
        priorityPredictedAt: new Date(),
        issueClusterId: aiResult.issue_cluster_id,
        duplicateOfId:
          aiResult.duplicate_detection?.issue_cluster?.duplicate_of != null
            ? String(aiResult.duplicate_detection.issue_cluster.duplicate_of)
            : null,
        timeline: {
          create: [
            {
              status: 'SUBMITTED',
              note: 'Complaint lodged by citizen with location and evidence.',
              author: user.name || 'Citizen',
              authorRole: 'CITIZEN',
            },
            {
              status: aiResult.manual_review ? 'UNDER_REVIEW' : 'SUBMITTED',
              note: `${this.createAiReasoning(aiResult)}${resolvedDept ? ` Auto-routed to ${resolvedDept.name}.` : ''}`,
              author: 'CivicResolve AI',
              authorRole: 'SYSTEM',
            },
            ...(assignedOfficerName
              ? [
                {
                  status: 'ASSIGNED',
                  note: `Automatically assigned to field officer ${assignedOfficerName} in ${resolvedDept?.name || 'department'} based on lowest active caseload.`,
                  author: 'Auto-Dispatch Pipeline',
                  authorRole: 'SYSTEM',
                },
              ]
              : []),
          ],
        },
      },
      include: STANDARD_COMPLAINT_INCLUDE,
    });

    await recordAuditLog({
      actorId: user.id,
      actorName: user.name || 'Citizen',
      actorRole: 'CITIZEN',
      departmentId: departmentId || null,
      complaintId: complaint.id,
      action: 'COMPLAINT_CREATED_AND_ROUTED',
      targetType: 'COMPLAINT',
      targetId: complaint.id,
      summary: `Complaint ${trackingNumber} (${category}) routed to ${resolvedDept?.name || 'Unassigned'} with priority ${priority}.`,
      metadata: {
        category,
        aiCategory: aiResult.category,
        departmentId,
        priority,
        priorityModelVersion: aiResult.model_version || 'priority-v2.0.0',
        assignedOfficerId,
      },
    });

    await createNotification({
      userId: user.id,
      complaintId: complaint.id,
      trackingNumber,
      phoneNumber: user.phoneNumber,
      title: `Complaint #${trackingNumber} Submitted`,
      message: `Your complaint has been submitted successfully and routed to ${resolvedDept?.name || 'the department'}.`,
      type: 'COMPLAINT_CREATED',
      channel: 'ALL',
      smsTemplate: 'COMPLAINT_RECEIVED',
      link: `/complaints/track?id=${trackingNumber}`,
    });

    if (resolvedDept?.primaryAdminId) {
      await createNotification({
        userId: resolvedDept.primaryAdminId,
        title: `New Complaint Routed`,
        message: `${trackingNumber} (${category}) assigned to ${resolvedDept.name}.`,
        type: 'NEW_COMPLAINT',
        link: `/admin/dashboard`,
      });
    }

    if (assignedOfficerUserId) {
      await createNotification({
        userId: assignedOfficerUserId,
        title: `New Case Assigned: ${trackingNumber}`,
        message: `You have been assigned ${category} grievance at ${location}.`,
        type: 'ASSIGNMENT',
        link: `/admin/dashboard`,
      });
    }

    invalidateStatsCache();
    return complaint;
  }

  private mapPriority(priority: string): string {
    const normalized = priority.toLowerCase();
    if (normalized === 'critical' || normalized === 'very_high') return 'VERY_HIGH';
    if (normalized === 'high') return 'HIGH';
    if (normalized === 'medium') return 'MEDIUM';
    if (normalized === 'low') return 'LOW';
    const error = new Error(`AI returned an unsupported priority: ${priority}`);
    Object.assign(error, { statusCode: 502 });
    throw error;
  }

  private createAiReasoning(result: AIAnalysis): string {
    const catConf = `${Math.round(result.category_confidence * 100)}%`;
    const priConf = result.priority_confidence ? `${Math.round(result.priority_confidence * 100)}%` : '';
    const confStr = priConf ? `(Category: ${catConf}, Priority: ${priConf})` : `(${catConf} confidence)`;
    const explanation = result.priority_explanation ? ` ${result.priority_explanation}` : '';
    const factors =
      result.priority_factors && result.priority_factors.length > 0
        ? ` Contributing Factors: ${result.priority_factors.join(', ')}.`
        : '';
    const reviewNote = result.manual_review ? ' Manual review is recommended.' : '';
    return `AI Priority: ${result.priority} | Category: ${result.category} ${confStr}.${explanation}${factors}${reviewNote}`;
  }

  /**
   * Override complaint priority with SLA recalculation and immutable audit trail.
   * Allowed: SUPER_ADMIN (any complaint) or DEPARTMENT_ADMIN (own department only).
   * Officers cannot override priority arbitrarily.
   */
  public async overridePriority(
    complaintId: string,
    newPriority: string,
    reason: string,
    authUser: AuthUserContext
  ) {
    const role = normalizeRole(authUser.role);
    if (role !== ROLES.SUPER_ADMIN && role !== ROLES.DEPARTMENT_ADMIN) {
      const error: any = new Error(
        'Forbidden: Only Super Admin or Department Admin (for own department) can override priority.'
      );
      error.statusCode = 403;
      throw error;
    }

    if (!reason || reason.trim().length < 3) {
      const error: any = new Error('A descriptive reason is required when overriding priority.');
      error.statusCode = 400;
      throw error;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { citizen: { select: { phoneNumber: true } } },
    });

    if (!complaint) {
      const error: any = new Error('Complaint not found.');
      error.statusCode = 404;
      throw error;
    }

    if (role === ROLES.DEPARTMENT_ADMIN) {
      assertDepartmentAccess(authUser, complaint.departmentId);
    }

    const mappedPriority = this.mapPriority(newPriority);
    const oldPriority = complaint.priority;

    const slaHours = this.getSlaHours(complaint.category, mappedPriority);
    const slaDeadline = new Date(new Date(complaint.createdAt).getTime() + slaHours * 60 * 60 * 1000);
    const authorName = authUser.name || role;

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        priority: mappedPriority,
        slaHours,
        slaDeadline,
      },
      include: STANDARD_COMPLAINT_INCLUDE,
    });

    await prisma.complaintTimeline.create({
      data: {
        complaintId,
        status: complaint.status,
        actionType: 'PRIORITY_OVERRIDE',
        note: `Priority overridden from ${oldPriority} to ${mappedPriority} by ${authorName} (${role}). Reason: ${reason.trim()}. SLA recalculated to ${slaHours}h.`,
        author: authorName,
        authorRole: role,
      },
    });

    await recordAuditLog({
      actorId: authUser.id,
      actorName: authorName,
      actorRole: role,
      departmentId: complaint.departmentId,
      complaintId,
      action: 'PRIORITY_OVERRIDE',
      targetType: 'COMPLAINT',
      targetId: complaintId,
      summary: `Priority changed ${oldPriority} -> ${mappedPriority} on ${complaint.trackingNumber}. Reason: ${reason.trim()}`,
      metadata: { oldPriority, newPriority: mappedPriority, reason: reason.trim() },
    });

    invalidateStatsCache();
    return updated;
  }

  /**
   * Reassign complaint across departments (SUPER_ADMIN ONLY).
   */
  public async reassignDepartment(
    complaintId: string,
    targetDepartmentId: string,
    reason: string,
    authUser: AuthUserContext
  ) {
    if (normalizeRole(authUser.role) !== ROLES.SUPER_ADMIN) {
      const err: any = new Error('Forbidden: Only Super Admin can transfer complaints across departments.');
      err.statusCode = 403;
      throw err;
    }

    const [complaint, targetDept] = await Promise.all([
      prisma.complaint.findUnique({ where: { id: complaintId }, include: { department: true } }),
      prisma.department.findUnique({ where: { id: targetDepartmentId } }),
    ]);

    if (!complaint) {
      const err: any = new Error('Complaint not found.');
      err.statusCode = 404;
      throw err;
    }
    if (!targetDept || targetDept.status !== 'ACTIVE') {
      const err: any = new Error('Target department not found or inactive.');
      err.statusCode = 404;
      throw err;
    }

    const oldDeptId = complaint.departmentId;
    const oldDeptName = complaint.department?.name || 'Unassigned';

    // Adjust previous officer active workload cleanly if moving away
    if (complaint.assignedOfficerId && oldDeptId !== targetDept.id) {
      await prisma.officer.updateMany({
        where: { id: complaint.assignedOfficerId, activeCases: { gt: 0 } },
        data: { activeCases: { decrement: 1 } },
      });
    }

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        departmentId: targetDept.id,
        assignedOfficerId: null,
        assignedOfficerName: null,
        assignedOfficerUserId: null,
        status: complaint.status === 'ASSIGNED' ? 'SUBMITTED' : complaint.status,
      },
      include: STANDARD_COMPLAINT_INCLUDE,
    });

    await prisma.complaintTimeline.create({
      data: {
        complaintId,
        status: updated.status,
        actionType: 'CROSS_DEPT_TRANSFER',
        note: `Transferred from ${oldDeptName} to ${targetDept.name} by Super Admin ${authUser.name || ''}. Reason: ${reason || 'Administrative reassignment'}.`,
        author: authUser.name || 'Super Admin',
        authorRole: 'SUPER_ADMIN',
      },
    });

    await recordAuditLog({
      actorId: authUser.id,
      actorName: authUser.name || 'Super Admin',
      actorRole: 'SUPER_ADMIN',
      departmentId: targetDept.id,
      complaintId,
      action: 'CROSS_DEPT_TRANSFER',
      targetType: 'COMPLAINT',
      targetId: complaintId,
      summary: `Transferred ${complaint.trackingNumber} from ${oldDeptName} to ${targetDept.name}.`,
      metadata: { oldDeptId, newDeptId: targetDept.id, reason },
    });

    if (targetDept.primaryAdminId) {
      await createNotification({
        userId: targetDept.primaryAdminId,
        title: `Complaint Transferred to ${targetDept.name}`,
        message: `${complaint.trackingNumber} transferred from ${oldDeptName}. Please assign an officer.`,
        type: 'CROSS_DEPT_TRANSFER',
        link: `/admin/dashboard`,
      });
    }

    invalidateStatsCache();
    return updated;
  }

  /**
   * Return only complaints belonging to the requesting citizen
   */
  public async getCitizenComplaints(citizenId: string) {
    return prisma.complaint.findMany({
      where: { citizenId },
      include: {
        department: { select: { id: true, name: true, code: true } },
        timeline: {
          select: { id: true, status: true, note: true, author: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        evidence: {
          select: { id: true, fileUrl: true, stage: true, caption: true, verified: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Track complaint by public tracking number (e.g. CMP-2026-1042)
   */
  public async getComplaintByTrackingNumber(trackingNumber: string) {
    const q = trackingNumber.trim().toUpperCase();

    const complaint = await prisma.complaint.findFirst({
      where: {
        OR: [{ trackingNumber: q }, { trackingNumber: { contains: q } }, { id: q }],
      },
      include: {
        department: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        evidence: { where: { verified: true }, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!complaint) {
      const error: any = new Error(`Complaint with tracking ID "${trackingNumber}" not found.`);
      error.statusCode = 404;
      throw error;
    }

    return complaint;
  }

  /**
   * Get single complaint with strict role & department isolation check
   */
  public async getComplaintById(complaintId: string, authUser: AuthUserContext) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: STANDARD_COMPLAINT_INCLUDE,
    });

    if (!complaint) {
      const error: any = new Error('Complaint not found.');
      error.statusCode = 404;
      throw error;
    }

    this.assertComplaintAccess(complaint, authUser);
    return complaint;
  }

  /**
   * Query complaints strictly scoped by caller's role & department
   */
  public async getAllComplaints(
    filters: {
      status?: string;
      priority?: string;
      category?: string;
      divisionId?: string;
      authorityId?: string;
      departmentId?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    authUser: AuthUserContext
  ) {
    const effectiveDeptId = resolveEffectiveDepartmentId(authUser, filters.departmentId);
    const role = normalizeRole(authUser.role);
    const where: any = {};

    if (effectiveDeptId) {
      where.departmentId = effectiveDeptId;
    }

    if (role === ROLES.OFFICER) {
      const officerOr: any[] = [{ assignedOfficerUserId: authUser.id }];
      if (authUser.officerId) {
        officerOr.push({ assignedOfficerId: authUser.officerId });
      }
      where.AND = [...(where.AND || []), { OR: officerOr }];
    } else if (role === ROLES.CITIZEN) {
      where.citizenId = authUser.id;
    }

    if (filters.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters.priority && filters.priority !== 'ALL') {
      where.priority = filters.priority;
    }
    if (filters.category && filters.category !== 'ALL') {
      where.category = { contains: filters.category, mode: 'insensitive' };
    }
    if (filters.divisionId && filters.divisionId !== 'ALL') {
      where.divisionId = filters.divisionId;
    }
    if (filters.authorityId && filters.authorityId !== 'ALL') {
      where.authorityId = filters.authorityId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { trackingNumber: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { location: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return prisma.complaint.findMany({
      where,
      include: COMPLAINT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update complaint status with RBAC, resolution evidence enforcement, and audit trail
   */
  public async updateComplaintStatus(
    complaintId: string,
    newStatus: string,
    options: {
      authUser: AuthUserContext;
      rejectionReason?: string;
      resolutionRemarks?: string;
      resolutionImageUrl?: string;
    }
  ) {
    const allowedStatuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
    ];

    if (!allowedStatuses.includes(newStatus)) {
      const error: any = new Error(`Invalid status transition: ${newStatus}`);
      error.statusCode = 400;
      throw error;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { evidence: true, citizen: { select: { id: true, phoneNumber: true } } },
    });

    if (!complaint) {
      const error: any = new Error('Complaint not found.');
      error.statusCode = 404;
      throw error;
    }

    this.assertComplaintAccess(complaint, options.authUser);

    const role = normalizeRole(options.authUser.role);
    const authorName = options.authUser.name || role;

    if (newStatus === 'REJECTED' && !options.rejectionReason) {
      const error: any = new Error('A rejection reason is strictly required when rejecting a complaint.');
      error.statusCode = 400;
      throw error;
    }

    // Resolution Verification Policy for Officers: require AFTER evidence or resolution photo + remarks
    if (newStatus === 'RESOLVED' && role === ROLES.OFFICER) {
      const hasAfterEvidence = complaint.evidence.some((e) => e.stage === 'AFTER');
      const hasInlineImage = Boolean(options.resolutionImageUrl || complaint.resolutionImageUrl);
      if (!hasAfterEvidence && !hasInlineImage) {
        const error: any = new Error(
          'Resolution photo evidence (AFTER work photo) is required before marking a complaint RESOLVED.'
        );
        error.statusCode = 400;
        throw error;
      }
      if (!options.resolutionRemarks || options.resolutionRemarks.trim().length < 5) {
        const error: any = new Error('Verification notes / resolution remarks (min 5 chars) are required.');
        error.statusCode = 400;
        throw error;
      }
    }

    let note = `Status updated from ${complaint.status} to ${newStatus}.`;
    if (newStatus === 'REJECTED') {
      note = `Complaint rejected. Reason: "${options.rejectionReason}".`;
    } else if (newStatus === 'RESOLVED') {
      note = `Work completed & signed off. Remarks: "${options.resolutionRemarks || 'Issue resolved successfully.'}".`;
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'REJECTED') {
      updateData.rejectionReason = options.rejectionReason;
    } else if (newStatus === 'RESOLVED') {
      updateData.resolutionRemarks = options.resolutionRemarks || 'Resolved';
      if (options.resolutionImageUrl) {
        updateData.resolutionImageUrl = options.resolutionImageUrl;
      }
      updateData.resolvedAt = new Date();
    }

    // Persist inline resolution image as Evidence record if supplied by Officer/Admin
    if (newStatus === 'RESOLVED' && options.resolutionImageUrl) {
      await prisma.evidence.create({
        data: {
          complaintId,
          uploadedByOfficerId: options.authUser.id,
          stage: 'AFTER',
          fileUrl: options.resolutionImageUrl,
          caption: options.resolutionRemarks || 'Resolution verification evidence',
          verified: role === ROLES.DEPARTMENT_ADMIN || role === ROLES.SUPER_ADMIN,
          verifiedById:
            role === ROLES.DEPARTMENT_ADMIN || role === ROLES.SUPER_ADMIN
              ? options.authUser.id
              : null,
          verifiedAt:
            role === ROLES.DEPARTMENT_ADMIN || role === ROLES.SUPER_ADMIN ? new Date() : null,
        },
      });
    }

    // Adjust officer caseload counters if closing/resolving an open complaint
    const wasOpen = !['RESOLVED', 'CLOSED', 'REJECTED'].includes(complaint.status);
    const isNowClosed = ['RESOLVED', 'CLOSED', 'REJECTED'].includes(newStatus);
    if (complaint.assignedOfficerId && wasOpen && isNowClosed) {
      await prisma.officer.updateMany({
        where: { id: complaint.assignedOfficerId },
        data: {
          activeCases: { decrement: 1 },
          ...(newStatus === 'RESOLVED' ? { resolvedCases: { increment: 1 } } : {}),
        },
      });
    }

    await prisma.complaintTimeline.create({
      data: {
        complaintId,
        status: newStatus,
        note,
        author: authorName,
        authorRole: role,
      },
    });

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: updateData,
      include: STANDARD_COMPLAINT_INCLUDE,
    });

    await recordAuditLog({
      actorId: options.authUser.id,
      actorName: authorName,
      actorRole: role,
      departmentId: complaint.departmentId,
      complaintId,
      action: `COMPLAINT_STATUS_${newStatus}`,
      targetType: 'COMPLAINT',
      targetId: complaintId,
      summary: `${complaint.trackingNumber} status ${complaint.status} -> ${newStatus}.`,
    });

    let smsTemplate: 'WORK_STARTED' | 'COMPLAINT_RESOLVED' | 'ACTION_REQUIRED' | 'STATUS_UPDATED' = 'STATUS_UPDATED';
    let cleanStatusTitle = `Complaint #${complaint.trackingNumber} Update`;
    let cleanStatusMessage = note;

    if (newStatus === 'IN_PROGRESS') {
      smsTemplate = 'WORK_STARTED';
      cleanStatusTitle = `Complaint #${complaint.trackingNumber} In Progress`;
      cleanStatusMessage = `Work has started on your complaint.`;
    } else if (newStatus === 'RESOLVED') {
      smsTemplate = 'COMPLAINT_RESOLVED';
      cleanStatusTitle = `Complaint #${complaint.trackingNumber} Resolved`;
      cleanStatusMessage = `Your complaint has been marked as resolved.`;
    } else if (newStatus === 'REOPENED') {
      cleanStatusTitle = `Complaint #${complaint.trackingNumber} Reopened`;
      cleanStatusMessage = `Your complaint has been reopened for further investigation.`;
    } else if (newStatus === 'REJECTED') {
      cleanStatusTitle = `Complaint #${complaint.trackingNumber} Rejected`;
      cleanStatusMessage = note || `Your complaint has been reviewed and closed with notes.`;
    } else if (newStatus === 'ACTION_REQUIRED' || (note && note.toLowerCase().includes('information'))) {
      smsTemplate = 'ACTION_REQUIRED';
      cleanStatusTitle = `Action Required: #${complaint.trackingNumber}`;
      cleanStatusMessage = note || `Additional information is required for your complaint.`;
    }

    await createNotification({
      userId: complaint.citizenId,
      complaintId: complaint.id,
      trackingNumber: complaint.trackingNumber,
      phoneNumber: complaint.citizen?.phoneNumber,
      title: cleanStatusTitle,
      message: cleanStatusMessage,
      type: newStatus === 'RESOLVED' ? 'RESOLUTION' : 'STATUS_CHANGE',
      channel: 'ALL',
      smsTemplate,
      additionalInfo: newStatus,
      link: `/complaints/track?id=${complaint.trackingNumber}`,
    });

    invalidateStatsCache();
    return updated;
  }

  /**
   * Assign an Officer (must belong to the same department as the complaint!)
   * Allowed: SUPER_ADMIN or DEPARTMENT_ADMIN (own dept only).
   */
  public async assignOfficer(
    complaintId: string,
    officerIdentifier: string,
    officerNameHint: string | undefined,
    authUser: AuthUserContext
  ) {
    const role = normalizeRole(authUser.role);
    if (role !== ROLES.SUPER_ADMIN && role !== ROLES.DEPARTMENT_ADMIN) {
      const err: any = new Error('Forbidden: Only Super Admin or Department Admin can assign officers.');
      err.statusCode = 403;
      throw err;
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { citizen: { select: { phoneNumber: true } } },
    });

    if (!complaint) {
      const error: any = new Error('Complaint not found.');
      error.statusCode = 404;
      throw error;
    }

    assertDepartmentAccess(authUser, complaint.departmentId);

    // Resolve officer either by Officer.id or Officer.userId
    const officer = await prisma.officer.findFirst({
      where: {
        OR: [{ id: officerIdentifier }, { userId: officerIdentifier }],
      },
      include: {
        user: { select: { id: true, isActive: true, role: true, name: true } },
      },
    });

    if (!officer) {
      const err: any = new Error('Officer not found.');
      err.statusCode = 404;
      throw err;
    }

    if (officer.user && !officer.user.isActive) {
      const err: any = new Error('Cannot assign complaint to an inactive officer.');
      err.statusCode = 400;
      throw err;
    }

    if (complaint.departmentId && officer.departmentId !== complaint.departmentId) {
      const err: any = new Error(
        'Forbidden: Cannot assign an officer from a different department.'
      );
      err.statusCode = 403;
      throw err;
    }

    const authorName = authUser.name || role;
    const resolvedOfficerName = officer.name || officerNameHint || 'Field Officer';
    const newStatus =
      complaint.status === 'SUBMITTED' || complaint.status === 'UNDER_REVIEW'
        ? 'ASSIGNED'
        : complaint.status;

    if (complaint.assignedOfficerId && complaint.assignedOfficerId !== officer.id) {
      await prisma.officer.updateMany({
        where: { id: complaint.assignedOfficerId, activeCases: { gt: 0 } },
        data: { activeCases: { decrement: 1 } },
      });
    }

    if (complaint.assignedOfficerId !== officer.id) {
      await prisma.officer.update({
        where: { id: officer.id },
        data: { activeCases: { increment: 1 } },
      });
    }

    await prisma.complaintTimeline.create({
      data: {
        complaintId,
        status: newStatus,
        actionType: 'OFFICER_ASSIGNED',
        note: `Assigned to Field Officer ${resolvedOfficerName} (${officer.badgeId || officer.id}) by ${authorName}.`,
        author: authorName,
        authorRole: role,
      },
    });

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        assignedOfficerId: officer.id,
        assignedOfficerName: resolvedOfficerName,
        assignedOfficerUserId: officer.userId || officer.user?.id || null,
        status: newStatus,
      },
      include: STANDARD_COMPLAINT_INCLUDE,
    });

    await recordAuditLog({
      actorId: authUser.id,
      actorName: authorName,
      actorRole: role,
      departmentId: complaint.departmentId,
      complaintId,
      action: 'ASSIGN_OFFICER',
      targetType: 'COMPLAINT',
      targetId: complaintId,
      summary: `Assigned ${complaint.trackingNumber} to officer ${resolvedOfficerName}.`,
      metadata: { officerId: officer.id, officerUserId: officer.userId },
    });

    if (complaint.citizenId) {
      await createNotification({
        userId: complaint.citizenId,
        complaintId: complaint.id,
        trackingNumber: complaint.trackingNumber,
        phoneNumber: complaint.citizen?.phoneNumber,
        title: `Officer Assigned: #${complaint.trackingNumber}`,
        message: `An officer has been assigned to your grievance and will review the case.`,
        type: 'OFFICER_ASSIGNED',
        channel: 'ALL',
        smsTemplate: 'STATUS_UPDATED',
        additionalInfo: 'Officer Assigned',
        link: `/complaints/track?id=${complaint.trackingNumber}`,
      });
    }

    if (officer.userId) {
      await createNotification({
        userId: officer.userId,
        complaintId: complaint.id,
        trackingNumber: complaint.trackingNumber,
        phoneNumber: officer.phoneNumber,
        title: `Case Assigned: ${complaint.trackingNumber}`,
        message: `${complaint.category} at ${complaint.location} has been assigned to you.`,
        type: 'ASSIGNMENT',
        link: `/admin/dashboard`,
      });
    }

    invalidateStatsCache();
    return updated;
  }

  /**
   * Compute live dashboard statistics strictly scoped by caller role & department
   */
  public async getAdminStats(authUser: AuthUserContext, requestedDepartmentId?: string) {
    const effectiveDeptId = resolveEffectiveDepartmentId(authUser, requestedDepartmentId);
    const role = normalizeRole(authUser.role);

    const cacheKey = `${effectiveDeptId || 'ALL'}:${role}:${authUser.id}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const baseWhere: any = {};

    if (effectiveDeptId) {
      baseWhere.departmentId = effectiveDeptId;
    }
    if (role === ROLES.OFFICER) {
      const officerOr: any[] = [{ assignedOfficerUserId: authUser.id }];
      if (authUser.officerId) {
        officerOr.push({ assignedOfficerId: authUser.officerId });
      }
      baseWhere.OR = officerOr;
    }

    const now = new Date();
    const [
      total,
      resolved,
      inProgress,
      pending,
      rejected,
      highPriority,
      slaBreached,
      resolvedComplaints,
    ] = await Promise.all([
      prisma.complaint.count({ where: baseWhere }),
      prisma.complaint.count({ where: { ...baseWhere, status: 'RESOLVED' } }),
      prisma.complaint.count({
        where: { ...baseWhere, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW'] } },
      }),
      prisma.complaint.count({ where: { ...baseWhere, status: 'SUBMITTED' } }),
      prisma.complaint.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      prisma.complaint.count({
        where: { ...baseWhere, priority: { in: ['VERY_HIGH', 'CRITICAL', 'HIGH', 'URGENT'] } },
      }),
      prisma.complaint.count({
        where: {
          ...baseWhere,
          status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] },
          slaDeadline: { lt: now },
        },
      }),
      prisma.complaint.findMany({
        where: { ...baseWhere, status: 'RESOLVED', resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    let avgResolutionHours = 0;
    if (resolvedComplaints.length > 0) {
      const totalHours = resolvedComplaints.reduce((acc, c) => {
        const diff =
          (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60);
        return acc + Math.max(0, diff);
      }, 0);
      avgResolutionHours = parseFloat((totalHours / resolvedComplaints.length).toFixed(1));
    }

    const resolutionRate = total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 0;

    const statsResult = {
      total,
      newComplaints: pending,
      pending,
      inProgress,
      resolved,
      rejected,
      highPriority,
      slaBreached,
      avgResolutionHours,
      complianceRate: resolutionRate,
      resolutionRate,
      departmentId: effectiveDeptId || null,
    };

    statsCache.set(cacheKey, { data: statsResult, timestamp: Date.now() });
    return statsResult;
  }
}
