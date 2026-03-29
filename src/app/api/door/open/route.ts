/**
 * Client (PWA) or admin calls this to open the door.
 * Validates membership (members) or bypasses (OWNER/STAFF), records entry, publishes MQTT.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, notFound } from "@/lib/api-helpers";
import { validateAndRecordEntry } from "@/lib/entry-logic";
import { publishDoorOpen } from "@/lib/mqtt-publish";

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

  // Validate + record entry (OWNER/STAFF bypass membership checks inside)
  const check = await validateAndRecordEntry(user.gymId, user.id, "PHONE", true);
  if (!check.allowed) return err(check.reason, 422);

  // Publish MQTT — ESP32 opens door instantly
  await publishDoorOpen(device.id);

  return ok({ opened: true });
}
