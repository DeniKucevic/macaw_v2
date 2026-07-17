/**
 * Telemetry ingest from the ESP32 — boot/PN532 status, errors, and card scans.
 * The device authenticates with its secret. ERROR-level lines are also pushed to
 * the alerts channel so you see reader/wiring failures without a USB cable.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";
import { notify } from "@/lib/notify";

const LogSchema = z.object({
  secret: z.string().min(1),
  level: z.enum(["INFO", "ERROR", "SCAN"]).default("INFO"),
  message: z.string().max(500),
  tagId: z.string().max(64).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = LogSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.secret !== parsed.data.secret) return unauthorized();

  await db.deviceLog.create({
    data: {
      deviceId,
      gymId: device.gymId,
      level: parsed.data.level,
      message: parsed.data.message,
      tagId: parsed.data.tagId ?? null,
    },
  });

  if (parsed.data.level === "ERROR") {
    await notify(`🛠️ ${device.name}: ${parsed.data.message}`);
  }

  return ok({ logged: true });
}
