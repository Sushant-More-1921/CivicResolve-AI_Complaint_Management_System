import { Response, NextFunction } from 'express';
import { AuthRequest, AuthUserContext, normalizeRole } from './auth.middleware';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DEPARTMENT_ADMIN: 'DEPARTMENT_ADMIN',
  OFFICER: 'OFFICER',
  CITIZEN: 'CITIZEN',
} as const;

export const requireRole = (roles: string[]) => {
  const allowed = new Set(roles.map((r) => normalizeRole(r)));
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: User context missing',
      });
      return;
    }

    const userRole = normalizeRole(req.user.role);
    if (!allowed.has(userRole)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Requires one of roles [${Array.from(allowed).join(', ')}]`,
      });
      return;
    }

    next();
  };
};

/**
 * Resolves the permitted departmentId for administrative / officer queries.
 * - SUPER_ADMIN: can access any department or all departments (undefined).
 * - DEPARTMENT_ADMIN / OFFICER: locked strictly to their own departmentId;
 *   requesting another department returns HTTP 403 Forbidden.
 */
export function resolveEffectiveDepartmentId(
  user: AuthUserContext | undefined,
  requestedDepartmentId?: string | null
): string | undefined {
  if (!user) {
    const err: any = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  const role = normalizeRole(user.role);
  const cleanedRequest =
    requestedDepartmentId && requestedDepartmentId !== 'ALL' && requestedDepartmentId.trim() !== ''
      ? requestedDepartmentId.trim()
      : undefined;

  if (role === ROLES.SUPER_ADMIN) {
    return cleanedRequest;
  }

  if (role === ROLES.DEPARTMENT_ADMIN || role === ROLES.OFFICER) {
    if (!user.departmentId) {
      const err: any = new Error('Forbidden: Account is not bound to any department.');
      err.statusCode = 403;
      throw err;
    }
    if (cleanedRequest && cleanedRequest !== user.departmentId) {
      const err: any = new Error('Forbidden: Cross-department access is prohibited.');
      err.statusCode = 403;
      throw err;
    }
    return user.departmentId;
  }

  const err: any = new Error('Forbidden: Administrative or officer clearance required.');
  err.statusCode = 403;
  throw err;
}

/**
 * Verifies a single record belongs to the caller's department (unless caller is SUPER_ADMIN).
 */
export function assertDepartmentAccess(
  user: AuthUserContext | undefined,
  targetDepartmentId?: string | null
): void {
  if (!user) {
    const err: any = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }
  const role = normalizeRole(user.role);
  if (role === ROLES.SUPER_ADMIN) return;

  if (role === ROLES.DEPARTMENT_ADMIN || role === ROLES.OFFICER) {
    if (!user.departmentId || !targetDepartmentId || user.departmentId !== targetDepartmentId) {
      const err: any = new Error('Forbidden: Cross-department access is prohibited.');
      err.statusCode = 403;
      throw err;
    }
    return;
  }

  const err: any = new Error('Forbidden: Insufficient privileges.');
  err.statusCode = 403;
  throw err;
}
