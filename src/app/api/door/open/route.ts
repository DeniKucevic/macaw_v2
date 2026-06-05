/**
 * Client (PWA) or admin calls this to open the door.
 * Validates membership (members) or bypasses (OWNER/STAFF), then queues a DoorRequest.
 * ESP32 picks it up via long polling on /api/device/[deviceId]/poll.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, notFound } from "@/lib/api-helpers";
import { validateAndRecordEntry } from "@/lib/entry-logic";
import { addSeconds } from "date-fns";
import { Role } from "@/generated/prisma/client";

const OpenDoorSchema = z.object({
  deviceId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return unauthorized();

  const body = await req.json();
  const parsed = OpenDoorSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const device = await db.device.findUnique({ where: { id: parsed.data.deviceId } });
  if (!device || device.gymId !== user.gymId) return notFound("Device");

  // OWNER/STAFF bypass membership checks — log entry and queue
  if (user.role === Role.OWNER || user.role === Role.STAFF) {
    await validateAndRecordEntry(user.gymId, user.id, "PHONE", true);
    const doorRequest = await db.doorRequest.create({
      data: {
        deviceId: device.id,
        userId: user.id,
        status: "PENDING",
        expiresAt: addSeconds(new Date(), 30),
      },
    });
    return ok({ queued: true, commandId: doorRequest.id });
  }

  // Members: validate and record entry
  const check = await validateAndRecordEntry(user.gymId, user.id, "PHONE", true);
  if (!check.allowed) return err(check.reason, 422);

  const doorRequest = await db.doorRequest.create({
    data: {
      deviceId: device.id,
      userId: user.id,
      status: "PENDING",
      expiresAt: addSeconds(new Date(), 30),
    },
  });

  return ok({ queued: true, commandId: doorRequest.id });
}
