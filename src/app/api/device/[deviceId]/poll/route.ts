/**
 * Short-poll endpoint for ESP32.
 * Checks once for a pending door command and returns immediately — it does NOT
 * hold the connection open. The device re-polls on its own ~2s timer, so keeping
 * the serverless function alive to "wait" would just burn Fluid provisioned
 * memory (billed on wall-clock alive time) for no benefit. Worst-case door
 * latency is one device poll interval (~2s), well within a command's 30s TTL.
 *
 * Response contract (must stay stable — the firmware reads `command.id`):
 *   { "command": { "id": string, "createdAt": string } }  // command ready
 *   { "command": null }                                     // nothing pending
 *
 * Kept lean because the device polls ~24/7:
 *  - the "last seen" heartbeat + stale-command cleanup only run once per
 *    HEARTBEAT_MS, not on every poll;
 *  - the pending-command check filters expired rows in-query.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";

const PollSchema = z.object({ secret: z.string().min(1) });

const HEARTBEAT_MS = 60000; // only refresh lastSeenAt / expire commands this often

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

  // Throttled heartbeat: only touch the DB if we haven't seen this device in
  // HEARTBEAT_MS or it was marked offline. Piggy-back the stale-command cleanup
  // here so it also runs ~once/minute instead of on every poll.
  const lastSeen = device.lastSeenAt?.getTime() ?? 0;
  if (!device.isOnline || now.getTime() - lastSeen >= HEARTBEAT_MS) {
    await db.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: now, isOnline: true },
    });
    await db.doorRequest.updateMany({
      where: { deviceId, status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
  }

  // Single check — return whatever's pending right now, then let the function exit.
  const command = await db.doorRequest.findFirst({
    where: { deviceId, status: "PENDING", expiresAt: { gte: now } },
    orderBy: { createdAt: "asc" },
  });

  return ok(
    command
      ? { command: { id: command.id, createdAt: command.createdAt } }
      : { command: null }
  );
}
