import { db } from "@/lib/db";
import { EntryMethod, MembershipStatus, Role } from "@/generated/prisma/client";
import { startOfDay, endOfDay } from "date-fns";

export type EntryResult =
  | { allowed: true; membership: { id: string; type: string; sessionsLeft: number | null; expiresAt: Date | null } }
  | { allowed: false; reason: string };

type DayConfig = { isOpen: boolean; open: string; close: string };
type HoursConfig = Record<string, DayConfig>;

function checkWorkingHours(
  gym: { timezone: string; hours: unknown } | null,
  method: EntryMethod
): { ok: true } | { ok: false; reason: string } {
  // MANUAL entries (staff override) always pass
  if (method === EntryMethod.MANUAL) return { ok: true };
  // No config = always open
  if (!gym || !gym.hours) return { ok: true };

  const hours = gym.hours as HoursConfig;

  // Get current day + time in gym's timezone
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: gym.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) ?? "";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "00";
  const currentTime = `${hourStr.padStart(2, "0")}:${minuteStr.padStart(2, "0")}`;

  const dayMap: Record<string, string> = {
    sun: "sun", mon: "mon", tue: "tue", wed: "wed",
    thu: "thu", fri: "fri", sat: "sat",
  };
  const dayKey = dayMap[weekdayStr];
  if (!dayKey) return { ok: true };

  const dayConfig = hours[dayKey];
  if (!dayConfig || !dayConfig.isOpen) {
    return { ok: false, reason: "Van radnog vremena" };
  }

  if (currentTime < dayConfig.open || currentTime >= dayConfig.close) {
    return { ok: false, reason: "Van radnog vremena" };
  }

  return { ok: true };
}

/**
 * Validate whether a user can enter the gym right now.
 * If allowed and commit=true, record the entry and update the membership.
 */
export async function validateAndRecordEntry(
  gymId: string,
  userId: string,
  method: EntryMethod,
  commit = true,
  notes?: string
): Promise<EntryResult> {
  const now = new Date();

  // OWNER/STAFF bypass all checks — no hours, no membership required
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role === Role.OWNER || user?.role === Role.STAFF) {
    if (commit) {
      await db.entry.create({
        data: { gymId, userId, membershipId: null, method, enteredAt: now, notes },
      });
    }
    return { allowed: true, membership: { id: "", type: "STAFF", sessionsLeft: null, expiresAt: null } };
  }

  // Check working hours
  const gym = await db.gym.findUnique({ where: { id: gymId }, select: { timezone: true, hours: true } });
  const hoursCheck = checkWorkingHours(gym, method);
  if (!hoursCheck.ok) return { allowed: false, reason: hoursCheck.reason };

  // Find the user's active membership
  const membership = await db.membership.findFirst({
    where: {
      gymId,
      userId,
      status: MembershipStatus.ACTIVE,
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!membership) {
    return { allowed: false, reason: "No active membership" };
  }

  // Check time-based expiry
  if (membership.plan.type === "TIME_BASED") {
    if (membership.expiresAt && membership.expiresAt < now) {
      if (commit) {
        await db.membership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.EXPIRED },
        });
      }
      return { allowed: false, reason: "Membership has expired" };
    }
  }

  // Check session-based exhaustion
  if (membership.plan.type === "SESSION_BASED") {
    const used = membership.sessionsUsed ?? 0;
    const total = membership.sessionsTotal ?? 0;
    if (used >= total) {
      if (commit) {
        await db.membership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.EXPIRED },
        });
      }
      return { allowed: false, reason: "No sessions remaining" };
    }
  }

  // Check max entries per day
  const maxPerDay = membership.maxPerDay ?? membership.plan.maxPerDay;
  const todayEntries = await db.entry.count({
    where: {
      gymId,
      userId,
      membershipId: membership.id,
      enteredAt: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
  });

  if (todayEntries >= maxPerDay) {
    return { allowed: false, reason: "Already entered today" };
  }

  // All good — record if commit
  if (commit) {
    await db.$transaction(async (tx) => {
      await tx.entry.create({
        data: {
          gymId,
          userId,
          membershipId: membership.id,
          method,
          enteredAt: now,
          notes,
        },
      });

      if (membership.plan.type === "SESSION_BASED") {
        await tx.membership.update({
          where: { id: membership.id },
          data: { sessionsUsed: { increment: 1 } },
        });
      }
    });
  }

  const sessionsLeft =
    membership.plan.type === "SESSION_BASED"
      ? (membership.sessionsTotal ?? 0) - (membership.sessionsUsed ?? 0) - (commit ? 1 : 0)
      : null;

  return {
    allowed: true,
    membership: {
      id: membership.id,
      type: membership.plan.type,
      sessionsLeft,
      expiresAt: membership.expiresAt,
    },
  };
}
