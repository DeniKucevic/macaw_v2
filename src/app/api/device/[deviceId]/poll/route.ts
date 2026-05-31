/**
 * Long-polling endpoint for ESP32.
 * Holds the connection open up to 8 seconds waiting for a pending door command.
 * Returns immediately when one is found, or { command: null } on timeout.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";

const PollSchema = z.object({ secret: z.string().min(1) });

const HOLD_MS    = 5000; // hold connection up to 5s (Vercel free = 10s max, need margin)
const TICK_MS    = 500;  // check DB every 500ms

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = PollSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.secret !== parsed.data.secret) return unauthorized();

  const now = new Date();
  await db.device.update({
    where: { id: deviceId },
    data: { lastSeenAt: now, isOnline: true },
  });

  // Expire stale commands
  await db.doorRequest.updateMany({
    where: { deviceId, status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });

  // Long poll — wait up to HOLD_MS for a command
  const deadline = Date.now() + HOLD_MS;
  while (Date.now() < deadline) {
    const command = await db.doorRequest.findFirst({
      where: { deviceId, status: "PENDING", expiresAt: { gte: new Date() } },
      orderBy: { createdAt: "asc" },
    });

    if (command && command.expiresAt.getTime() > Date.now()) {
      return ok({ command: { id: command.id, createdAt: command.createdAt } });
    }

    await new Promise((r) => setTimeout(r, TICK_MS));
  }

  return ok({ command: null });
}
