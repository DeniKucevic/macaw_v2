/**
 * ESP32 calls this endpoint when it scans an RFID tag.
 * The device authenticates with its secret key.
 * Returns allow/deny with user info so the ESP32 can open the relay.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";
import { validateAndRecordEntry } from "@/lib/entry-logic";

const RfidSchema = z.object({
  tagId: z.string().min(1),
  secret: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = RfidSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Authenticate device
  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.secret !== parsed.data.secret) return unauthorized();

  // Update device last seen
  await db.device.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date(), isOnline: true },
  });

  // Look up RFID tag
  const rfidTag = await db.rfidTag.findUnique({
    where: { tagId: parsed.data.tagId },
    include: { user: true },
  });

  if (!rfidTag || !rfidTag.isActive) {
    return ok({ allowed: false, reason: "Unknown or inactive tag" });
  }

  if (rfidTag.user.gymId !== device.gymId) {
    return ok({ allowed: false, reason: "Tag does not belong to this gym" });
  }

  const result = await validateAndRecordEntry(
    device.gymId,
    rfidTag.userId,
    "RFID",
    true
  );

  return ok({
    ...result,
    user: { id: rfidTag.user.id, name: rfidTag.user.name },
  });
}
