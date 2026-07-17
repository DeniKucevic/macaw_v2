/**
 * Daily membership expiry sweep (Vercel Cron — see vercel.json).
 * Flips memberships that are still ACTIVE but no longer valid to EXPIRED, so
 * every page's "active" count is accurate without relying on the lazy check
 * that only ran on an entry attempt.
 *
 * Secured with CRON_SECRET: Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * on scheduled invocations when that env var is set.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api-helpers";
import { MembershipStatus } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const now = new Date();

  // Time-based memberships whose expiry has passed. (Session-based rows have a
  // null expiresAt, so this only touches dated ones.)
  const timeExpired = await db.membership.updateMany({
    where: { status: MembershipStatus.ACTIVE, expiresAt: { not: null, lt: now } },
    data: { status: MembershipStatus.EXPIRED },
  });

  // Session-based memberships with no sessions left. Needs a column-to-column
  // comparison, which updateMany can't express — so run it as raw SQL.
  const sessionExhausted = await db.$executeRaw`
    UPDATE "Membership"
    SET status = 'EXPIRED', "updatedAt" = now()
    WHERE status = 'ACTIVE'
      AND "sessionsTotal" IS NOT NULL
      AND "sessionsUsed" >= "sessionsTotal"
  `;

  // Log retention: bound growth regardless of a misbehaving device.
  // DeviceLog is operational telemetry (ephemeral) — keep 30 days.
  // AuditLog is the security trail — keep 1 year.
  const DAY = 24 * 60 * 60 * 1000;
  const deviceLogsPruned = await db.deviceLog.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 30 * DAY) } },
  });
  const auditLogsPruned = await db.auditLog.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 365 * DAY) } },
  });

  return ok({
    ranAt: now.toISOString(),
    timeExpired: timeExpired.count,
    sessionExhausted,
    deviceLogsPruned: deviceLogsPruned.count,
    auditLogsPruned: auditLogsPruned.count,
  });
}
