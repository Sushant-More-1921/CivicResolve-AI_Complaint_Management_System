import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';

export interface AuthUserContext {
  id: string;
  role: string; // Canonical: CITIZEN | OFFICER | DEPARTMENT_ADMIN | SUPER_ADMIN
  rawRole?: string;
  name?: string | null;
  phoneNumber?: string;
  departmentId?: string | null;
  officerId?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUserContext;
}

export function normalizeRole(role?: string | null): string {
  const upper = (role || 'CITIZEN').trim().toUpperCase();
  if (upper === 'ADMIN') return 'DEPARTMENT_ADMIN';
  return upper;
}

async function resolveUserContext(userId: string): Promise<AuthUserContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      name: true,
      phoneNumber: true,
      departmentId: true,
      isActive: true,
      officerProfile: {
        select: { id: true, departmentId: true },
      },
    },
  });

  if (!user) return null;
  if (!user.isActive) {
    const err: any = new Error('Your account has been deactivated. Contact an administrator.');
    err.statusCode = 403;
    throw err;
  }

  const canonicalRole = normalizeRole(user.role);
  if (canonicalRole === 'FIELD_WORKER') {
    const err: any = new Error('Field Workers do not have application login access.');
    err.statusCode = 403;
    throw err;
  }

  return {
    id: user.id,
    role: canonicalRole,
    rawRole: user.role,
    name: user.name,
    phoneNumber: user.phoneNumber,
    departmentId: user.departmentId || user.officerProfile?.departmentId || null,
    officerId: user.officerProfile?.id || null,
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      role: string;
      phoneNumber?: string;
      departmentId?: string | null;
    };

    const userContext = await resolveUserContext(decoded.id);
    if (!userContext) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Account no longer exists',
      });
      return;
    }

    req.user = userContext;
    next();
  } catch (error: any) {
    if (error?.statusCode === 403) {
      res.status(403).json({
        success: false,
        message: error.message,
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired token',
    });
  }
};

export const optionalAuthMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        id: string;
        role: string;
        phoneNumber?: string;
      };
      const userContext = await resolveUserContext(decoded.id).catch(() => null);
      if (userContext) {
        req.user = userContext;
      }
    }
  } catch {
    // Optional auth ignores expired/missing tokens cleanly
  }
  next();
};
