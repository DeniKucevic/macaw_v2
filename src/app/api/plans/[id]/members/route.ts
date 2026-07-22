import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role, MembershipStatus } from "@/generated/prisma/client";

// Lists every membership that references a plan — active AND historical
// (expired / suspended / cancelled) — so the owner can see exactly WHO is on a
// plan and why it can't be hard-deleted. Note these are membership records, not
// distinct people: one member can appear more than once (e.g. a renewed plan).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || (caller.role !== Role.OWNER && caller.role !== Role.STAFF)) {
    return forbidden();
  }

  const plan = await db.membershipPlan.findUnique({
    where: { id },
    select: { id: true, name: true, type: true, gymId: true },
  });
  if (!plan || plan.gymId !== caller.gymId) return notFound("Plan");

  const rows = await db.membership.findMany({
    where: { planId: id },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      sessionsTotal: true,
      sessionsUsed: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = Date.now();
  const members = rows.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    userName: m.user.name,
    status: m.status,
    expiresAt: m.expiresAt,
    sessionsTotal: m.sessionsTotal,
    sessionsUsed: m.sessionsUsed,
    // "Truly active" matches the plans-page count: ACTIVE and not past expiry.
    isCurrentlyActive:
      m.status === MembershipStatus.ACTIVE &&
      (m.expiresAt === null || m.expiresAt.getTime() >= now),
  }));

  return ok({
    planName: plan.name,
    planType: plan.type,
    totalCount: members.length,
    activeCount: members.filter((m) => m.isCurrentlyActive).length,
    members,
  });
}
