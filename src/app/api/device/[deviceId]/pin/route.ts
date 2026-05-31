/**
 * ESP32 calls this endpoint when a member types their PIN on the keypad.
 * Looks up user by gymId + plain PIN (unique constraint in DB).
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";
import { validateAndRecordEntry } from "@/lib/entry-logic";

const PinSchema = z.object({
  pin: z.string().length(6).regex(/^\d{6}$/),
  secret: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = PinSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Authenticate device
  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.secret !== parsed.data.secret) return unauthorized();

  // Update device last seen
  await db.device.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date(), isOnline: true },
  });

  // Look up user by gymId + pin (unique constraint guarantees at most one result)
  const user = await db.user.findFirst({
    where: { gymId: device.gymId, pin: parsed.data.pin },
    select: { id: true, name: true },
  });

  if (!user) {
    return ok({ allowed: false, reason: "PIN nije prepoznat" });
  }

  const result = await validateAndRecordEntry(
    device.gymId,
    user.id,
    "PIN",
    true
  );

  return ok({
    ...result,
    user: { id: user.id, name: user.name },
  });
}
