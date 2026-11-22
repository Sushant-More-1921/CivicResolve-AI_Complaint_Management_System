import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AuthRequest, normalizeRole } from '../../middleware/auth.middleware';
import {
  ROLES,
  assertDepartmentAccess,
  resolveEffectiveDepartmentId,
} from '../../middleware/role.middleware';
import { recordAuditLog } from '../audit/audit.service';

function normalizeIndianPhone(phone: string): string {
  let cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
    cleanPhone = cleanPhone.slice(2);
  }
  return cleanPhone;
}

export class AdminController {
  /**
   * Lists departments with counts and primary Department Admin info.
   */
  public getDepartments = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.user ? normalizeRole(req.user.role) : null;
      const where: any = {};
      if (role === ROLES.DEPARTMENT_ADMIN || role === ROLES.OFFICER) {
        if (!req.user?.departmentId) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Account is not bound to any department.',
          });
        }
        where.id = req.user.departmentId;
      }

      const departments = await prisma.department.findMany({
        where,
        include: {
          primaryAdmin: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
              designation: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              complaints: true,
              officers: true,
              fieldWorkers: true,
              tasks: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.status(200).json({
        success: true,
        count: departments.length,
        data: departments,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: Create a new department.
   */
  public createDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, code, description, contactEmail, contactPhone, headOfficerName } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Department name is required.' });
      }

      const cleanCode = code
        ? String(code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        : name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20);

      const created = await prisma.department.create({
        data: {
          name: name.trim(),
          code: cleanCode,
          description: description || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          headOfficerName: headOfficerName || null,
          status: 'ACTIVE',
        },
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        departmentId: created.id,
        action: 'CREATE_DEPARTMENT',
        targetType: 'DEPARTMENT',
        targetId: created.id,
        summary: `Created department "${created.name}" (${created.code}).`,
      });

      res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'A department with this name or code already exists.',
        });
      }
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: Update department details/status.
   */
  public updateDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { name, description, contactEmail, contactPhone, status, headOfficerName } = req.body;

      const updated = await prisma.department.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(contactEmail !== undefined ? { contactEmail } : {}),
          ...(contactPhone !== undefined ? { contactPhone } : {}),
          ...(headOfficerName !== undefined ? { headOfficerName } : {}),
          ...(status !== undefined ? { status: String(status).toUpperCase() } : {}),
        },
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        departmentId: id,
        action: 'UPDATE_DEPARTMENT',
        targetType: 'DEPARTMENT',
        targetId: id,
        summary: `Updated department "${updated.name}" (${updated.status}).`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: List all primary Department Admins across departments.
   */
  public getDepartmentAdmins = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const admins = await prisma.user.findMany({
        where: { role: { in: ['DEPARTMENT_ADMIN', 'ADMIN'] } },
        include: {
          department: { select: { id: true, name: true, code: true, status: true } },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      });

      res.status(200).json({
        success: true,
        count: admins.length,
        data: admins.map((a) => ({
          id: a.id,
          name: a.name,
          phoneNumber: a.phoneNumber,
          email: a.email,
          designation: a.designation,
          role: 'DEPARTMENT_ADMIN',
          isActive: a.isActive,
          departmentId: a.departmentId,
          department: a.department,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: Create or assign a single active Primary Department Admin for a department.
   * Rejects creation with 409 Conflict if department already has an active primary Department Admin
   * (unless using replace-admin / replaceExisting=true).
   */
  public createOrAssignDepartmentAdmin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const {
        name,
        phoneNumber,
        email,
        designation = 'Primary Department Administrator',
        departmentId: bodyDepartmentId,
        district = 'Kolhapur',
        replaceExisting = false,
      } = req.body;

      const departmentId = String(req.params.departmentId || bodyDepartmentId || '').trim();
      if (!departmentId) {
        return res.status(400).json({ success: false, message: 'departmentId is required.' });
      }
      if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Admin name is required.' });
      }
      const cleanPhone = normalizeIndianPhone(String(phoneNumber || ''));
      if (cleanPhone.length !== 10) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit Indian mobile number.',
        });
      }

      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        return res.status(404).json({ success: false, message: 'Department not found.' });
      }

      const existingPhoneUser = await prisma.user.findUnique({ where: { phoneNumber: cleanPhone } });
      if (existingPhoneUser && normalizeRole(existingPhoneUser.role) === ROLES.SUPER_ADMIN) {
        return res.status(409).json({
          success: false,
          message: 'Cannot demote or reassign the system Super Admin account.',
        });
      }

      const cleanEmail =
        email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;

      const result = await prisma.$transaction(async (tx) => {
        const activeAdmin = await tx.user.findFirst({
          where: {
            departmentId,
            role: { in: ['DEPARTMENT_ADMIN', 'ADMIN'] },
            isActive: true,
          },
        });

        if (activeAdmin && activeAdmin.phoneNumber !== cleanPhone) {
          if (!replaceExisting) {
            const err: any = new Error(
              `Department "${dept.name}" already has an active primary Department Admin (${activeAdmin.name || activeAdmin.phoneNumber}). Use Replace Department Admin to transfer ownership.`
            );
            err.statusCode = 409;
            throw err;
          }

          await tx.department.updateMany({
            where: { primaryAdminId: activeAdmin.id },
            data: { primaryAdminId: null },
          });
          await tx.user.update({
            where: { id: activeAdmin.id },
            data: { isActive: false },
          });
        }

        // Clear primaryAdminId if this user previously held primary status elsewhere
        if (existingPhoneUser) {
          await tx.department.updateMany({
            where: { primaryAdminId: existingPhoneUser.id, id: { not: departmentId } },
            data: { primaryAdminId: null },
          });
        }

        const adminUser = await tx.user.upsert({
          where: { phoneNumber: cleanPhone },
          create: {
            phoneNumber: cleanPhone,
            name: String(name).trim(),
            email: cleanEmail,
            designation: String(designation).trim(),
            role: 'DEPARTMENT_ADMIN',
            departmentId,
            district,
            isActive: true,
          },
          update: {
            name: String(name).trim(),
            email: cleanEmail,
            designation: String(designation).trim(),
            role: 'DEPARTMENT_ADMIN',
            departmentId,
            district,
            isActive: true,
          },
        });

        await tx.department.update({
          where: { id: departmentId },
          data: {
            primaryAdminId: adminUser.id,
            headOfficerName: adminUser.name,
          },
        });

        return { adminUser, replacedAdminId: activeAdmin?.id || null };
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        departmentId,
        action: result.replacedAdminId ? 'REPLACE_DEPT_ADMIN' : 'ASSIGN_DEPT_ADMIN',
        targetType: 'USER',
        targetId: result.adminUser.id,
        summary: `${result.replacedAdminId ? 'Replaced' : 'Assigned'} primary Department Admin ${result.adminUser.name} for ${dept.name}.`,
        metadata: {
          departmentId,
          adminId: result.adminUser.id,
          replacedAdminId: result.replacedAdminId,
        },
      });

      res.status(result.replacedAdminId ? 200 : 201).json({
        success: true,
        message: `Primary Department Admin "${result.adminUser.name}" assigned to ${dept.name}.`,
        data: result.adminUser,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message:
            'Conflict: Active primary Department Admin uniqueness or email/phone constraint violated.',
        });
      }
      next(error);
    }
  };

  /**
   * Lists officers strictly scoped to caller's department (or all / filtered for SUPER_ADMIN).
   */
  public getOfficers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const requestedDeptId = req.query.departmentId as string | undefined;
      const effectiveDeptId = resolveEffectiveDepartmentId(req.user, requestedDeptId);

      const where: any = {};
      if (effectiveDeptId) {
        where.departmentId = effectiveDeptId;
      }

      const officers = await prisma.officer.findMany({
        where,
        include: {
          department: true,
          user: {
            select: {
              id: true,
              role: true,
              district: true,
              email: true,
              isActive: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const enhanced = officers.map((o) => ({
        ...o,
        userId: o.userId || o.user?.id || null,
        role: o.user?.role ? normalizeRole(o.user.role) : 'OFFICER',
        district: o.user?.district || 'Kolhapur',
        isActive: o.user ? o.user.isActive : true,
      }));

      res.status(200).json({
        success: true,
        count: enhanced.length,
        data: enhanced,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Add or update an Officer inside a department.
   * - DEPARTMENT_ADMIN: strictly confined to OWN department, can ONLY create role OFFICER (403 otherwise).
   * - SUPER_ADMIN: cannot create a second SUPER_ADMIN (409 Conflict); can assign/create OFFICER or single primary DEPARTMENT_ADMIN.
   */
  public addOfficer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const callerRole = normalizeRole(req.user?.role);
      const {
        name,
        phoneNumber,
        email,
        designation,
        departmentId: bodyDepartmentId,
        badgeId,
        role: rawRequestedRole = 'OFFICER',
        division = 'Kolhapur',
        isAvailable = true,
      } = req.body;

      const requestedRole = normalizeRole(String(rawRequestedRole || 'OFFICER'));

      if (requestedRole === 'FIELD_WORKER') {
        return res.status(400).json({
          success: false,
          message: 'Field Workers are non-login employee records. Use /admin/field-workers.',
        });
      }

      // Single active Super Admin rule
      if (requestedRole === ROLES.SUPER_ADMIN) {
        return res.status(409).json({
          success: false,
          message:
            'System policy violation: Exactly one active Super Admin is permitted in the system.',
        });
      }

      if (callerRole === ROLES.DEPARTMENT_ADMIN && requestedRole !== ROLES.OFFICER) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Department Admins can only create Officers in their own department.',
        });
      }

      if (requestedRole === ROLES.DEPARTMENT_ADMIN) {
        req.params.departmentId = String(bodyDepartmentId || '');
        return this.createOrAssignDepartmentAdmin(req, res, next);
      }

      // OFFICER creation path
      const effectiveDeptId = resolveEffectiveDepartmentId(req.user, bodyDepartmentId);
      if (!effectiveDeptId) {
        return res.status(400).json({
          success: false,
          message: 'A valid departmentId is required for creating an Officer.',
        });
      }

      const deptExists = await prisma.department.findUnique({ where: { id: effectiveDeptId } });
      if (!deptExists) {
        return res.status(404).json({ success: false, message: 'Department not found.' });
      }

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Officer name is required (minimum 2 characters).',
        });
      }

      const cleanPhone = normalizeIndianPhone(String(phoneNumber || ''));
      if (cleanPhone.length !== 10) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit Indian mobile number.',
        });
      }

      const existingPhoneUser = await prisma.user.findUnique({ where: { phoneNumber: cleanPhone } });
      if (existingPhoneUser) {
        const existingRole = normalizeRole(existingPhoneUser.role);
        if (existingRole === ROLES.SUPER_ADMIN || existingRole === ROLES.DEPARTMENT_ADMIN) {
          return res.status(409).json({
            success: false,
            message: `Phone number already belongs to an active ${existingRole} account.`,
          });
        }
        if (
          callerRole === ROLES.DEPARTMENT_ADMIN &&
          existingPhoneUser.departmentId &&
          existingPhoneUser.departmentId !== effectiveDeptId
        ) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: Cannot modify an officer belonging to another department.',
          });
        }
      }

      const cleanEmail =
        email && typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
      const cleanDesignation =
        designation && typeof designation === 'string' && designation.trim()
          ? designation.trim()
          : 'Field Officer';
      const finalBadgeId =
        badgeId && typeof badgeId === 'string' && badgeId.trim()
          ? badgeId.trim().toUpperCase()
          : `MH-OFF-${cleanPhone.slice(-4)}`;

      const officer = await prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { phoneNumber: cleanPhone },
          create: {
            phoneNumber: cleanPhone,
            name: name.trim(),
            email: cleanEmail,
            designation: cleanDesignation,
            departmentId: effectiveDeptId,
            role: 'OFFICER',
            district: division || 'Kolhapur',
            isActive: true,
          },
          update: {
            name: name.trim(),
            email: cleanEmail,
            designation: cleanDesignation,
            departmentId: effectiveDeptId,
            role: 'OFFICER',
            district: division || 'Kolhapur',
            isActive: true,
          },
        });

        return tx.officer.upsert({
          where: { phoneNumber: cleanPhone },
          create: {
            name: name.trim(),
            phoneNumber: cleanPhone,
            email: cleanEmail,
            designation: cleanDesignation,
            badgeId: finalBadgeId,
            departmentId: effectiveDeptId,
            userId: user.id,
            isAvailable: Boolean(isAvailable),
            activeCases: 0,
            resolvedCases: 0,
            rating: 5.0,
          },
          update: {
            name: name.trim(),
            email: cleanEmail,
            designation: cleanDesignation,
            badgeId: finalBadgeId,
            departmentId: effectiveDeptId,
            userId: user.id,
            isAvailable: Boolean(isAvailable),
          },
          include: { department: true },
        });
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || callerRole,
        actorRole: callerRole,
        departmentId: effectiveDeptId,
        action: 'CREATE_OFFICER',
        targetType: 'USER',
        targetId: officer.userId || officer.id,
        summary: `Registered Officer "${officer.name}" (${officer.badgeId}) in ${deptExists.name}.`,
      });

      return res.status(201).json({
        success: true,
        message: `Officer "${officer.name}" successfully registered in ${deptExists.name}.`,
        data: {
          ...officer,
          role: 'OFFICER',
          district: division || 'Kolhapur',
          isActive: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'An officer or user with this phone number, email, or badge ID already exists.',
        });
      }
      next(error);
    }
  };

  /**
   * Update officer availability or active status (Department-isolated).
   */
  public updateOfficer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { name, designation, email, isAvailable, isActive } = req.body;

      const officer = await prisma.officer.findUnique({ where: { id } });
      if (!officer) {
        return res.status(404).json({ success: false, message: 'Officer not found.' });
      }

      assertDepartmentAccess(req.user, officer.departmentId);

      const updated = await prisma.$transaction(async (tx) => {
        const nextOfficer = await tx.officer.update({
          where: { id },
          data: {
            ...(name !== undefined ? { name: String(name).trim() } : {}),
            ...(designation !== undefined ? { designation: String(designation).trim() } : {}),
            ...(email !== undefined ? { email: email ? String(email).trim() : null } : {}),
            ...(isAvailable !== undefined ? { isAvailable: Boolean(isAvailable) } : {}),
            ...(isActive !== undefined && isActive === false ? { isAvailable: false } : {}),
          },
          include: { department: true },
        });

        if (officer.userId) {
          await tx.user.update({
            where: { id: officer.userId },
            data: {
              ...(name !== undefined ? { name: String(name).trim() } : {}),
              ...(designation !== undefined ? { designation: String(designation).trim() } : {}),
              ...(email !== undefined ? { email: email ? String(email).trim() : null } : {}),
              ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
            },
          });
        }
        return nextOfficer;
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || req.user?.role,
        actorRole: req.user?.role,
        departmentId: officer.departmentId,
        action: 'UPDATE_OFFICER',
        targetType: 'USER',
        targetId: officer.userId || officer.id,
        summary: `Updated Officer "${updated.name}".`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  public deleteOfficer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const officer = await prisma.officer.findUnique({ where: { id } });
      if (!officer) {
        return res.status(404).json({ success: false, message: 'Officer not found' });
      }

      assertDepartmentAccess(req.user, officer.departmentId);

      await prisma.$transaction(async (tx) => {
        await tx.officer.delete({ where: { id } });
        if (officer.userId) {
          await tx.user.update({
            where: { id: officer.userId },
            data: { isActive: false },
          });
        }
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || req.user?.role,
        actorRole: req.user?.role,
        departmentId: officer.departmentId,
        action: 'DELETE_OFFICER',
        targetType: 'USER',
        targetId: officer.userId || id,
        summary: `Removed Officer "${officer.name}" from active roster.`,
      });

      return res.status(200).json({
        success: true,
        message: `Officer "${officer.name}" removed from active roster.`,
      });
    } catch (error) {
      next(error);
    }
  };

  // =========================================================================
  // FIELD WORKERS (EMPLOYEE RECORDS ONLY — ZERO LOGIN, ZERO TOKENS, ZERO ROLES)
  // =========================================================================

  public getFieldWorkers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const requestedDeptId = req.query.departmentId as string | undefined;
      const effectiveDeptId = resolveEffectiveDepartmentId(req.user, requestedDeptId);
      const statusFilter = req.query.status as string | undefined;

      const where: any = {};
      if (effectiveDeptId) {
        where.departmentId = effectiveDeptId;
      }
      if (statusFilter && statusFilter !== 'ALL') {
        where.status = statusFilter;
      }

      const workers = await prisma.fieldWorker.findMany({
        where,
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { taskAssignments: true } },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
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

  public createFieldWorker = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const {
        name,
        phone,
        designation = 'Field Technician',
        skills,
        departmentId: bodyDepartmentId,
        availabilityStatus = 'AVAILABLE',
      } = req.body;

      // Reject any attempt to supply login/role/credential attributes for a Field Worker
      if (req.body.role || req.body.password || req.body.passwordHash || req.body.loginEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Field Workers are non-login employee records and cannot have user roles or credentials.',
        });
      }

      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Field worker name is required.' });
      }

      const effectiveDeptId = resolveEffectiveDepartmentId(req.user, bodyDepartmentId);
      if (!effectiveDeptId) {
        return res.status(400).json({
          success: false,
          message: 'departmentId is required to register a Field Worker.',
        });
      }

      const dept = await prisma.department.findUnique({ where: { id: effectiveDeptId } });
      if (!dept) {
        return res.status(404).json({ success: false, message: 'Department not found.' });
      }

      const worker = await prisma.fieldWorker.create({
        data: {
          name: name.trim(),
          phone: phone ? String(phone).trim() : null,
          designation: String(designation || 'Field Technician').trim(),
          skills: skills ? String(skills).trim() : null,
          departmentId: effectiveDeptId,
          availabilityStatus: ['AVAILABLE', 'ON_TASK', 'OFF_DUTY'].includes(availabilityStatus)
            ? availabilityStatus
            : 'AVAILABLE',
          status: 'ACTIVE',
          createdById: req.user?.id || null,
        },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || req.user?.role,
        actorRole: req.user?.role,
        departmentId: effectiveDeptId,
        action: 'CREATE_FIELD_WORKER',
        targetType: 'FIELD_WORKER',
        targetId: worker.id,
        summary: `Added Field Worker employee record "${worker.name}" to ${dept.name}.`,
      });

      res.status(201).json({
        success: true,
        message: `Field worker "${worker.name}" added to ${dept.name}.`,
        data: worker,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateFieldWorker = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.fieldWorker.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Field worker record not found.' });
      }

      assertDepartmentAccess(req.user, existing.departmentId);

      const { name, phone, designation, skills, availabilityStatus, status } = req.body;
      if (name !== undefined && (!String(name).trim() || String(name).trim().length < 2)) {
        return res.status(400).json({ success: false, message: 'Field worker name must be at least 2 characters.' });
      }
      const nextAvailability =
        availabilityStatus !== undefined && ['AVAILABLE', 'ON_TASK', 'OFF_DUTY'].includes(availabilityStatus)
          ? availabilityStatus
          : undefined;
      const nextStatus =
        status !== undefined && ['ACTIVE', 'INACTIVE'].includes(status)
          ? status
          : undefined;

      const updated = await prisma.fieldWorker.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: String(name).trim() } : {}),
          ...(phone !== undefined ? { phone: phone ? String(phone).trim() : null } : {}),
          ...(designation !== undefined && String(designation).trim() ? { designation: String(designation).trim() } : {}),
          ...(skills !== undefined ? { skills: skills ? String(skills).trim() : null } : {}),
          ...(nextAvailability !== undefined ? { availabilityStatus: nextAvailability } : {}),
          ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        },
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || req.user?.role,
        actorRole: req.user?.role,
        departmentId: existing.departmentId,
        action: 'UPDATE_FIELD_WORKER',
        targetType: 'FIELD_WORKER',
        targetId: id,
        summary: `Updated Field Worker "${updated.name}" (status: ${updated.status}, availability: ${updated.availabilityStatus}).`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  public deleteFieldWorker = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const existing = await prisma.fieldWorker.findUnique({
        where: { id },
        include: { _count: { select: { taskAssignments: true } } },
      });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Field worker record not found.' });
      }

      assertDepartmentAccess(req.user, existing.departmentId);

      if (existing._count.taskAssignments > 0) {
        const deactivated = await prisma.fieldWorker.update({
          where: { id },
          data: { status: 'INACTIVE', availabilityStatus: 'OFF_DUTY' },
        });
        return res.status(200).json({
          success: true,
          message: `Field worker "${existing.name}" marked INACTIVE (preserved historical task links).`,
          data: deactivated,
        });
      }

      await prisma.fieldWorker.delete({ where: { id } });
      return res.status(200).json({
        success: true,
        message: `Field worker "${existing.name}" deleted.`,
      });
    } catch (error) {
      next(error);
    }
  };

  // =========================================================================
  // ANALYTICS, AUDIT LOGS & GOVERNANCE (STRICTLY SCOPED BY ROLE / DEPARTMENT)
  // =========================================================================

  public getDistrictStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const effectiveDeptId = resolveEffectiveDepartmentId(
        req.user,
        req.query.departmentId as string | undefined
      );

      const complaints = await prisma.complaint.findMany({
        where: effectiveDeptId ? { departmentId: effectiveDeptId } : undefined,
        select: {
          id: true,
          divisionName: true,
          districtName: true,
          status: true,
          priority: true,
          departmentId: true,
          assignedOfficerId: true,
        },
      });

      const MAHARASHTRA_DIVISIONS = [
        {
          divisionId: 'div-pune',
          divisionName: 'Pune Division',
          districts: ['Pune', 'Kolhapur', 'Solapur', 'Satara', 'Sangli'],
          headquarters: 'Pune',
        },
        {
          divisionId: 'div-kolhapur',
          divisionName: 'Kolhapur District',
          districts: ['Kolhapur City', 'Karveer', 'Shirol', 'Hatkanangle', 'Ichalkaranji', 'Pattankodoli'],
          headquarters: 'Kolhapur',
        },
        {
          divisionId: 'div-nashik',
          divisionName: 'Nashik Division',
          districts: ['Nashik', 'Ahmednagar', 'Jalgaon', 'Dhule', 'Nandurbar'],
          headquarters: 'Nashik',
        },
        {
          divisionId: 'div-konkan',
          divisionName: 'Konkan Division (Mumbai & Thane)',
          districts: ['Mumbai City', 'Mumbai Suburban', 'Thane', 'Navi Mumbai', 'Palghar', 'Raigad'],
          headquarters: 'Navi Mumbai',
        },
        {
          divisionId: 'div-aurangabad',
          divisionName: 'Chhatrapati Sambhajinagar Division',
          districts: ['Chhatrapati Sambhajinagar', 'Jalna', 'Parbhani', 'Beed', 'Nanded'],
          headquarters: 'Chhatrapati Sambhajinagar',
        },
        {
          divisionId: 'div-nagpur',
          divisionName: 'Nagpur Division',
          districts: ['Nagpur', 'Wardha', 'Chandrapur', 'Bhandara', 'Gondia', 'Gadchiroli'],
          headquarters: 'Nagpur',
        },
        {
          divisionId: 'div-amravati',
          divisionName: 'Amravati Division',
          districts: ['Amravati', 'Akola', 'Buldhana', 'Yavatmal', 'Washim'],
          headquarters: 'Amravati',
        },
      ];

      const divisionStats = MAHARASHTRA_DIVISIONS.map((div) => {
        const matches = complaints.filter(
          (c) =>
            c.divisionName?.toLowerCase().includes(div.headquarters.toLowerCase()) ||
            c.districtName?.toLowerCase().includes(div.headquarters.toLowerCase()) ||
            div.districts.some(
              (d) =>
                c.divisionName?.toLowerCase().includes(d.toLowerCase()) ||
                c.districtName?.toLowerCase().includes(d.toLowerCase())
            )
        );

        const total = matches.length;
        const resolved = matches.filter((c) => c.status === 'RESOLVED').length;
        const pending = total - resolved;
        const critical = matches.filter(
          (c) =>
            c.priority === 'HIGH' ||
            c.priority === 'VERY_HIGH' ||
            c.priority === 'CRITICAL' ||
            c.priority === 'URGENT'
        ).length;
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        const assignedOfficers = matches.filter((c) => Boolean(c.assignedOfficerId)).length;

        return {
          ...div,
          totalComplaints: total,
          resolvedComplaints: resolved,
          pendingComplaints: pending,
          criticalComplaints: critical,
          resolutionRate,
          assignedOfficers,
        };
      });

      const totalAcrossDistricts = divisionStats.reduce((acc, d) => acc + d.totalComplaints, 0);
      const totalResolvedAcrossDistricts = divisionStats.reduce(
        (acc, d) => acc + d.resolvedComplaints,
        0
      );

      res.status(200).json({
        success: true,
        data: {
          departmentId: effectiveDeptId || null,
          totalComplaints: totalAcrossDistricts,
          totalResolved: totalResolvedAcrossDistricts,
          totalPending: totalAcrossDistricts - totalResolvedAcrossDistricts,
          avgResolutionRate:
            totalAcrossDistricts > 0
              ? Math.round((totalResolvedAcrossDistricts / totalAcrossDistricts) * 100)
              : 0,
          districts: divisionStats,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getPlatformOverview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const effectiveDeptId = resolveEffectiveDepartmentId(
        req.user,
        req.query.departmentId as string | undefined
      );

      const complaintWhere = effectiveDeptId ? { departmentId: effectiveDeptId } : undefined;
      const officerWhere = effectiveDeptId ? { departmentId: effectiveDeptId } : undefined;
      const workerWhere = effectiveDeptId ? { departmentId: effectiveDeptId } : undefined;

      const [
        totalComplaints,
        totalUsers,
        totalOfficers,
        totalFieldWorkers,
        totalDepartments,
        recentComplaints,
        categoriesGroup,
        statusGroup,
        priorityGroup,
        departmentBreakdown,
      ] = await Promise.all([
        prisma.complaint.count({ where: complaintWhere }),
        effectiveDeptId
          ? prisma.user.count({ where: { departmentId: effectiveDeptId } })
          : prisma.user.count(),
        prisma.officer.count({ where: officerWhere }),
        prisma.fieldWorker.count({ where: workerWhere }),
        effectiveDeptId ? Promise.resolve(1) : prisma.department.count(),
        prisma.complaint.findMany({
          where: complaintWhere,
          take: 8,
          orderBy: { createdAt: 'desc' },
          include: { department: true, citizen: { select: { name: true, phoneNumber: true } } },
        }),
        prisma.complaint.groupBy({
          by: ['category'],
          where: complaintWhere,
          _count: { category: true },
        }),
        prisma.complaint.groupBy({
          by: ['status'],
          where: complaintWhere,
          _count: { status: true },
        }),
        prisma.complaint.groupBy({
          by: ['priority'],
          where: complaintWhere,
          _count: { priority: true },
        }),
        effectiveDeptId
          ? Promise.resolve([])
          : prisma.department.findMany({
              include: {
                primaryAdmin: { select: { id: true, name: true, phoneNumber: true, isActive: true } },
                _count: {
                  select: { complaints: true, officers: true, fieldWorkers: true },
                },
              },
              orderBy: { name: 'asc' },
            }),
      ]);

      let aiHealth = 'HEALTHY';
      try {
        const aiRes = await fetch(`${env.AI_SERVICE_URL.replace(/\/+$/, '')}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!aiRes.ok) aiHealth = 'DEGRADED';
      } catch {
        aiHealth = 'OFFLINE';
      }

      res.status(200).json({
        success: true,
        data: {
          departmentId: effectiveDeptId || null,
          metrics: {
            totalComplaints,
            totalUsers,
            totalOfficers,
            totalFieldWorkers,
            totalDepartments,
            systemHealth: 'OPERATIONAL',
            aiServiceStatus: aiHealth,
            databaseStatus: 'CONNECTED',
            uptimeSeconds: Math.floor(process.uptime()),
          },
          breakdowns: {
            byCategory: categoriesGroup.map((g) => ({
              category: g.category,
              count: g._count.category,
            })),
            byStatus: statusGroup.map((g) => ({ status: g.status, count: g._count.status })),
            byPriority: priorityGroup.map((g) => ({
              priority: g.priority,
              count: g._count.priority,
            })),
            byDepartment: departmentBreakdown,
          },
          recentComplaints,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const effectiveDeptId = resolveEffectiveDepartmentId(
        req.user,
        req.query.departmentId as string | undefined
      );
      const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 40));

      const [systemLogs, timelineLogs] = await Promise.all([
        prisma.auditLog.findMany({
          where: effectiveDeptId ? { departmentId: effectiveDeptId } : undefined,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            department: { select: { id: true, name: true } },
            complaint: {
              select: {
                id: true,
                trackingNumber: true,
                title: true,
                category: true,
                status: true,
              },
            },
          },
        }),
        prisma.complaintTimeline.findMany({
          where: effectiveDeptId ? { complaint: { departmentId: effectiveDeptId } } : undefined,
          take: limit,
          orderBy: { createdAt: 'desc' },
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
          },
        }),
      ]);

      const merged = [
        ...systemLogs.map((l) => ({
          id: l.id,
          complaintId: l.complaintId,
          trackingNumber: l.complaint?.trackingNumber,
          complaintTitle: l.complaint?.title || l.department?.name || l.targetType,
          category: l.complaint?.category || l.department?.name,
          status: l.complaint?.status || l.action,
          actionType: l.action,
          note: l.summary,
          author: l.actorName || 'System',
          authorRole: l.actorRole || 'SYSTEM',
          timestamp: l.createdAt,
        })),
        ...timelineLogs.map((log) => ({
          id: log.id,
          complaintId: log.complaintId,
          trackingNumber: log.complaint?.trackingNumber,
          complaintTitle: log.complaint?.title,
          category: log.complaint?.category,
          status: log.status,
          actionType: log.actionType || 'STATUS_UPDATE',
          note: log.note,
          author: log.author,
          authorRole: log.authorRole,
          timestamp: log.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      res.status(200).json({
        success: true,
        count: merged.length,
        data: merged,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: List users globally.
   */
  public getUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const role = req.query.role as string | undefined;
      const search = req.query.search as string | undefined;

      const where: any = {};
      if (role && role !== 'ALL') {
        where.role = role === 'DEPARTMENT_ADMIN' ? { in: ['DEPARTMENT_ADMIN', 'ADMIN'] } : role;
      }
      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { phoneNumber: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ];
      }

      const users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          department: true,
          _count: { select: { complaints: true } },
        },
      });

      res.status(200).json({
        success: true,
        count: users.length,
        data: users.map((u) => ({
          id: u.id,
          name: u.name || 'Citizen User',
          phoneNumber: u.phoneNumber,
          email: u.email,
          role: normalizeRole(u.role),
          designation: u.designation,
          departmentId: u.departmentId,
          department: u.department?.name,
          district: u.district || 'Kolhapur',
          complaintsCount: u._count.complaints,
          isActive: u.isActive,
          createdAt: u.createdAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: Update user role while enforcing:
   * - Single active SUPER_ADMIN
   * - Single active primary DEPARTMENT_ADMIN per department
   */
  public updateUserRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { role: rawRole, departmentId } = req.body;
      const role = normalizeRole(String(rawRole || ''));
      const validRoles = ['CITIZEN', 'OFFICER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN'];
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        });
      }

      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (role === ROLES.SUPER_ADMIN) {
        const existingSuper = await prisma.user.findFirst({
          where: { role: 'SUPER_ADMIN', isActive: true, id: { not: id } },
        });
        if (existingSuper) {
          return res.status(409).json({
            success: false,
            message: 'Exactly one active Super Admin is allowed in the system.',
          });
        }
      }

      if (role === ROLES.DEPARTMENT_ADMIN) {
        const targetDept = departmentId || targetUser.departmentId;
        if (!targetDept) {
          return res.status(400).json({
            success: false,
            message: 'departmentId is required when assigning DEPARTMENT_ADMIN role.',
          });
        }
        const activeDeptAdmin = await prisma.user.findFirst({
          where: {
            departmentId: targetDept,
            role: { in: ['DEPARTMENT_ADMIN', 'ADMIN'] },
            isActive: true,
            id: { not: id },
          },
        });
        if (activeDeptAdmin) {
          return res.status(409).json({
            success: false,
            message: 'Department already has an active primary Department Admin. Use Replace Admin instead.',
          });
        }
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          role,
          ...(departmentId !== undefined ? { departmentId } : {}),
        },
      });

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        departmentId: updated.departmentId,
        action: 'UPDATE_USER_ROLE',
        targetType: 'USER',
        targetId: id,
        summary: `Updated user ${updated.name || updated.phoneNumber} role to ${role}.`,
      });

      res.status(200).json({
        success: true,
        message: `User role updated to ${role}.`,
        data: { ...updated, role: normalizeRole(updated.role) },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          success: false,
          message: 'Uniqueness constraint violated (Super Admin or Department Admin limit).',
        });
      }
      next(error);
    }
  };

  /**
   * SUPER_ADMIN ONLY: Activate or deactivate a user account.
   */
  public updateUserStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isActive boolean is required.' });
      }

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (normalizeRole(target.role) === ROLES.SUPER_ADMIN && !isActive) {
        return res.status(409).json({
          success: false,
          message: 'Cannot deactivate the sole Super Admin account.',
        });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive },
      });

      if (target.role === 'OFFICER') {
        await prisma.officer.updateMany({
          where: { userId: id },
          data: { isAvailable: isActive },
        });
      }

      await recordAuditLog({
        actorId: req.user?.id,
        actorName: req.user?.name || 'Super Admin',
        actorRole: 'SUPER_ADMIN',
        departmentId: updated.departmentId,
        action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        targetType: 'USER',
        targetId: id,
        summary: `${isActive ? 'Activated' : 'Deactivated'} user ${updated.name || updated.phoneNumber}.`,
      });

      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}
