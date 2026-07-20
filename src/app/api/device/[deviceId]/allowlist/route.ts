/**
 * Offline allowlist for the ESP32.
 *
 * The device caches this so it can still open the door when the network or the
 * server is down. Only cards that are valid RIGHT NOW are included, and the
 * response carries `maxStaleHours`: once the device's copy is older than that
 * it must stop honouring it, so someone revoked while the device was offline
 * can't keep walking in indefinitely.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";
import { MembershipStatus, Role } from "@/generated/prisma/client";

const Schema = z.object({ secret: z.string().min(1) });

/** How long the device may trust a cached copy before refusing offline entry. */
export const MAX_STALE_HOURS = 24;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.secret !== parsed.data.secret) return unauthorized();

  const now = new Date();

  const tags = await db.rfidTag.findMany({
    where: {
      isActive: true,
      user: {
        gymId: device.gymId,
        OR: [
          // Staff/owner always get in — they bypass membership checks online too.
          { role: { in: [Role.OWNER, Role.STAFF] } },
          // Members need a membership that is valid at this moment.
          {
            memberships: {
              some: {
                gymId: device.gymId,
                status: MembershipStatus.ACTIVE,
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
              },
            },
          },
        ],
      },
    },
    select: { tagId: true },
  });

  // Session-based plans can be exhausted; that needs a column comparison the
  // relation filter can't express, so drop those users here.
  const exhausted = await db.$queryRaw<{ tagId: string }[]>`
    SELECT t."tagId"
    FROM "RfidTag" t
    JOIN "User" u ON u.id = t."userId"
    JOIN "Membership" m ON m."userId" = u.id AND m."gymId" = ${device.gymId}
    WHERE u."gymId" = ${device.gymId}
      AND u.role = 'MEMBER'
      AND m.status = 'ACTIVE'
      AND m."sessionsTotal" IS NOT NULL
      AND m."sessionsUsed" >= m."sessionsTotal"
  `;
  const exhaustedSet = new Set(exhausted.map((r) => r.tagId));

  const allow = tags.map((t) => t.tagId).filter((t) => !exhaustedSet.has(t));

  return ok({
    tags: allow,
    count: allow.length,
    generatedAt: now.toISOString(),
    maxStaleHours: MAX_STALE_HOURS,
  });
}
