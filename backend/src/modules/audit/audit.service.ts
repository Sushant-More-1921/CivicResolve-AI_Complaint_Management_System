import { prisma } from '../../config/database';

export interface AuditLogInput {
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  departmentId?: string | null;
  complaintId?: string | null;
  action: string;
  targetType: 'USER' | 'DEPARTMENT' | 'COMPLAINT' | 'FIELD_WORKER' | 'TASK' | 'EVIDENCE' | 'SYSTEM';
  targetId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persists an immutable audit trail entry for administrative, operational, and RBAC events.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId || null,
        actorName: input.actorName || null,
        actorRole: input.actorRole || null,
        departmentId: input.departmentId || null,
        complaintId: input.complaintId || null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId || null,
        summary: input.summary,
        metadata: (input.metadata as any) || undefined,
      },
    });
  } catch (err) {
    // Audit logging should not mask primary business error paths, but must be visible in server logs.
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}

