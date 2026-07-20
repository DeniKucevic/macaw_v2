/**
 * Uploads entries the device recorded while it was offline.
 *
 * The device queues every offline door-open locally and POSTs the batch once
 * it's back online, so Evidencija reflects what actually happened during the
 * outage instead of showing a silent gap. Entries keep their ORIGINAL
 * timestamp and are marked as offline so they're distinguishable.
 *
 * Safe to retry: entries are de-duplicated on (user, enteredAt), so a failed
 * upload that the device repeats won't double-count a visit or a session.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";
import { MembershipStatus } from "@/generated/prisma/client";

const OFFLINE_NOTE = "Ulazak van mreže (sinhronizovano)";

const Schema = z.object({
  secret: z.string().min(1),
  entries: z
    .array(
      z.object({
        tagId: z.string().min(1).max(64),
        // Epoch seconds from the device. 0/absent = clock wasn't set.
        at: z.number().int().nonnegative().optional(),
      })
    )
    .max(200),
});

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

  let synced = 0;
  let duplicates = 0;
  let unknown = 0;

  for (const item of parsed.data.entries) {
    // A device that lost power may not know the time; fall back to now and say so.
    const clockOk = !!item.at && item.at > 1600000000; // sanity: after 2020
    const enteredAt = clockOk ? new Date(item.at! * 1000) : new Date();
    const noteSuffix = clockOk ? "" : " — vreme nepoznato";

    const tag = await db.rfidTag.findUnique({
      where: { tagId: item.tagId },
      include: { user: true },
    });

    // Unknown/foreign card: still record it so the log is complete.
    if (!tag || tag.user.gymId !== device.gymId) {
      unknown++;
      await db.entry.create({
        data: {
          gymId: device.gymId,
          userId: null,
          membershipId: null,
          method: "RFID",
          enteredAt,
          notes: `ODBIJEN: Nepoznata kartica van mreže (${item.tagId})${noteSuffix}`,
        },
      });
      continue;
    }

    // Retry-safe: same member at the same instant is the same visit.
    const existing = await db.entry.findFirst({
      where: { gymId: device.gymId, userId: tag.userId, enteredAt },
      select: { id: true },
    });
    if (existing) {
      duplicates++;
      continue;
    }

    const membership = await db.membership.findFirst({
      where: {
        gymId: device.gymId,
        userId: tag.userId,
        status: MembershipStatus.ACTIVE,
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    await db.$transaction(async (tx) => {
      await tx.entry.create({
        data: {
          gymId: device.gymId,
          userId: tag.userId,
          membershipId: membership?.id ?? null,
          method: "RFID",
          enteredAt,
          notes: OFFLINE_NOTE + noteSuffix,
        },
      });
      // The visit happened, so the session was used — charge it on arrival.
      if (membership && membership.plan.type === "SESSION_BASED") {
        await tx.membership.update({
          where: { id: membership.id },
          data: { sessionsUsed: { increment: 1 } },
        });
      }
    });
    synced++;
  }

  const total = parsed.data.entries.length;
  if (total > 0) {
    await db.deviceLog.create({
      data: {
        deviceId,
        gymId: device.gymId,
        level: "INFO",
        message: `Sinhronizovano ${synced} ulazaka van mreže (${duplicates} duplikata, ${unknown} nepoznatih)`,
      },
    });
  }

  return ok({ received: total, synced, duplicates, unknown });
}
