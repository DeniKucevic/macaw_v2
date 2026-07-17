/**
 * Device-offline check. Marks devices that have gone silent as offline, records
 * a DEVICE_OFFLINE audit event, and sends an alert (if a channel is configured).
 *
 * Scheduling note: Vercel Hobby crons run at most once/day, which is too coarse
 * for a door controller. For near-real-time alerts, point a free external cron
 * (e.g. cron-job.org, every 5 min) at this endpoint with the Bearer header, or
 * upgrade to Vercel Pro for sub-daily schedules. The daily vercel.json entry is
 * a baseline safety net.
 *
 * Secured with CRON_SECRET (Vercel sends it as a Bearer token on scheduled runs).
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, unauthorized } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";

const OFFLINE_AFTER_MS = 5 * 60 * 1000; // no poll for 5 min => offline

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized();
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - OFFLINE_AFTER_MS);

  // Marked online but silent past the cutoff.
  const stale = await db.device.findMany({
    where: { isOnline: true, lastSeenAt: { lt: cutoff } },
  });

  for (const device of stale) {
    await db.device.update({ where: { id: device.id }, data: { isOnline: false } });
    await logAudit({
      gymId: device.gymId,
      action: "DEVICE_OFFLINE",
      targetType: "Device",
      targetId: device.id,
      targetLabel: device.name,
      details: { lastSeenAt: device.lastSeenAt?.toISOString() ?? null },
    });
    await notify(
      `⚠️ Device "${device.name}" is offline. Last seen: ${
        device.lastSeenAt?.toISOString() ?? "unknown"
      }.`
    );
  }

  return ok({ ranAt: now.toISOString(), markedOffline: stale.length });
}
