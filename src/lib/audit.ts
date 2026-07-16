import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type AuditInput = {
  gymId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
};

/**
 * Records an admin/system action. Best-effort: a logging failure must never
 * break the operation being logged, so errors are swallowed (and printed).
 */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        gymId: input.gymId,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        details: (input.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("[audit] failed to record", input.action, e);
  }
}
