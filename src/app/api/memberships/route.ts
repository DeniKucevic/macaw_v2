import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { addDays } from "date-fns";

const CreateMembershipSchema = z.object({
  userId: z.string(),
  planId: z.string(),
  startsAt: z.string().optional(), // ISO date, defaults to now
  notes: z.string().optional(),
  maxPerDayOverride: z.number().int().positive().optional(),
  // For session-based: can override session count
  sessionsOverride: z.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("userId");

  // Staff/Owner can query anyone; members can only see themselves
  if (user.role === Role.MEMBER) {
    const memberships = await db.membership.findMany({
      where: { userId: user.id, gymId: user.gymId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(memberships);
  }

  const where = memberId
    ? { gymId: user.gymId, userId: memberId }
    : { gymId: user.gymId };

  const memberships = await db.membership.findMany({
    where,
    include: { plan: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return ok(memberships);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const staff = await db.user.findUnique({ where: { id: session.user.id } });
  if (!staff || (staff.role !== Role.OWNER && staff.role !== Role.STAFF)) {
    return forbidden();
  }

  const body = await req.json();
  const parsed = CreateMembershipSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { userId, planId, notes, maxPerDayOverride, sessionsOverride } = parsed.data;
  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : new Date();

  // Verify the target user belongs to the same gym
  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser || targetUser.gymId !== staff.gymId) return notFound("Member");

  const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.gymId !== staff.gymId) return notFound("Plan");

  const expiresAt =
    plan.type === "TIME_BASED" && plan.durationDays
      ? addDays(startsAt, plan.durationDays)
      : null;

  const membership = await db.membership.create({
    data: {
      gymId: staff.gymId,
      userId,
      planId,
      startsAt,
      expiresAt,
      sessionsTotal: plan.type === "SESSION_BASED" ? (sessionsOverride ?? plan.sessionCount) : null,
      sessionsUsed: plan.type === "SESSION_BASED" ? 0 : null,
      maxPerDay: maxPerDayOverride,
      notes,
      status: "ACTIVE",
    },
    include: { plan: true, user: { select: { id: true, name: true, email: true } } },
  });

  return ok(membership, 201);
}
