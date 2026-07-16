/**
 * Long-polling endpoint for ESP32.
 * Holds the connection open up to HOLD_MS waiting for a pending door command.
 * Returns immediately when one is found, or { command: null } on timeout.
 *
 * Response contract (must stay stable — the firmware reads `command.id`):
 *   { "command": { "id": string, "createdAt": string } }  // command ready
 *   { "command": null }                                     // nothing pending
 *
 * The device polls ~24/7, so this path is deliberately lean:
 *  - the "last seen" heartbeat + stale-command cleanup only run once per
 *    HEARTBEAT_MS, not on every poll (kills ~9/10 of the writes);
 *  - the pending-command check filters expired rows in-query, so we don't need
 *    to expire them on the hot path;
 *  - the in-hold poll runs every TICK_MS (1s) — plenty responsive for a door.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";

const PollSchema = z.object({ secret: z.string().min(1) });

const HOLD_MS      = 5000;  // hold connection up to 5s (Vercel free = 10s max, need margin)
const TICK_MS      = 1000;  // check DB every 1s during the hold
const HEARTBEAT_MS = 60000; // only refresh lastSeenAt / expire commands this often

async function findPending(deviceId: string) {
  return db.doorRequest.findFirst({
    where: { deviceId, status: "PENDING", expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "asc" },
  });
}

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

  // Long poll — check now, then every TICK_MS until the hold expires.
  const deadline = Date.now() + HOLD_MS;
  for (;;) {
    const command = await findPending(deviceId);
    if (command) {
      return ok({ command: { id: command.id, createdAt: command.createdAt } });
    }
    if (Date.now() + TICK_MS >= deadline) break;
    await new Promise((r) => setTimeout(r, TICK_MS));
  }

  return ok({ command: null });
}
