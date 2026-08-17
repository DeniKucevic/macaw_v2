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
 *  - device auth is cached in-process (AUTH_TTL_MS), so the common poll skips the
 *    per-request `device.findUnique` — on a warm Fluid instance ~29 of every 30
 *    polls do a single DB round-trip (the pending-command check) instead of two;
 *  - the "last seen" heartbeat + stale-command cleanup only run once per
 *    HEARTBEAT_MS, now gated by an in-process timer rather than a DB read;
 *  - the pending-command check filters expired rows in-query and ALWAYS runs —
 *    it is never cached, so door latency/reliability are unchanged.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, unauthorized } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const PollSchema = z.object({ secret: z.string().min(1) });

const HEARTBEAT_MS = 60000; // only refresh lastSeenAt / expire commands this often
const AUTH_TTL_MS = 60000; // how long a device's secret stays trusted in-process

// Module-scoped caches persist across invocations on a warm Fluid instance (and
// simply repopulate from the DB on a cold one). Bounded by device count, which
// is small and fixed. A changed/revoked secret keeps working for up to
// AUTH_TTL_MS on an already-warm instance — an acceptable window for a door
// controller. Multiple warm instances each keep their own copy, so the heartbeat
// may write a few extra times per minute; the update is idempotent.
const authCache = new Map<string, { secret: string; expiresAt: number }>();
const lastHeartbeatAt = new Map<string, number>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await req.json();
  const parsed = PollSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const nowMs = Date.now();

  // Auth from the in-process cache when it's fresh; otherwise fall through to a
  // DB read below (which also runs on the heartbeat tick / cold instances).
  const cachedAuth = authCache.get(deviceId);
  const authedFromCache =
    !!cachedAuth && cachedAuth.expiresAt > nowMs;
  if (authedFromCache && cachedAuth!.secret !== parsed.data.secret) {
    return unauthorized();
  }

  // Heartbeat is throttled by an in-process timer so the common poll never reads
  // the device row. On the ~once/minute tick — or any poll that couldn't auth
  // from cache (cold instance / expired entry) — we read the device, refresh
  // lastSeenAt/isOnline, expire stale commands, and log offline->online.
  const heartbeatDue = nowMs - (lastHeartbeatAt.get(deviceId) ?? 0) >= HEARTBEAT_MS;

  if (!authedFromCache || heartbeatDue) {
    const device = await db.device.findUnique({ where: { id: deviceId } });
    if (!device || device.secret !== parsed.data.secret) return unauthorized();
    authCache.set(deviceId, {
      secret: device.secret,
      expiresAt: nowMs + AUTH_TTL_MS,
    });

    if (heartbeatDue) {
      lastHeartbeatAt.set(deviceId, nowMs);
      const now = new Date(nowMs);
      const wasOffline = !device.isOnline;
      await db.device.update({
        where: { id: deviceId },
        data: { lastSeenAt: now, isOnline: true },
      });
      await db.doorRequest.updateMany({
        where: { deviceId, status: "PENDING", expiresAt: { lt: now } },
        data: { status: "EXPIRED" },
      });
      if (wasOffline) {
        await logAudit({
          gymId: device.gymId,
          action: "DEVICE_ONLINE",
          targetType: "Device",
          targetId: deviceId,
          targetLabel: device.name,
        });
      }
    }
  }

  // Single check — runs on EVERY poll, never cached. Return whatever's pending
  // right now, then let the function exit.
  const now = new Date(nowMs);
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
