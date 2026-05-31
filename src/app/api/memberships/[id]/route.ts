import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { addDays } from "date-fns";

const UpdateMembershipSchema = z.object({
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED", "CANCELLED"]).optional(),
  expiresAt: z.string().optional(),
  sessionsTotal: z.number().int().nonnegative().optional(),
  sessionsUsed: z.number().int().nonnegative().optional(),
  maxPerDay: z.number().int().positive().nullable().optional(),
  notes: z.string().optional(),
  // Extend a time-based membership by N extra days
  extendDays: z.number().int().positive().optional(),
  // Add extra sessions
  addSessions: z.number().int().positive().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller) return unauthorized();

  const membership = await db.membership.findUnique({
    where: { id },
    include: {
      plan: true,
      user: { select: { id: true, name: true, email: true } },
      entries: { orderBy: { enteredAt: "desc" }, take: 20 },
    },
  });

  if (!membership || membership.gymId !== caller.gymId) return notFound("Membership");
  if (caller.role === Role.MEMBER && membership.userId !== caller.id) return forbidden();

  return ok(membership);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const staff = await db.user.findUnique({ where: { id: session.user.id } });
  if (!staff || (staff.role !== Role.OWNER && staff.role !== Role.STAFF)) {
    return forbidden();
  }

  const membership = await db.membership.findUnique({
    where: { id },
    include: { plan: true },
  });
  if (!membership || membership.gymId !== staff.gymId) return notFound("Membership");

  const body = await req.json();
  const parsed = UpdateMembershipSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { extendDays, addSessions, ...directUpdates } = parsed.data;

  const updateData: Record<string, unknown> = { ...directUpdates };

  if (extendDays) {
    const base = membership.expiresAt ?? new Date();
    updateData.expiresAt = addDays(base, extendDays);
    updateData.status = "ACTIVE";
  }
  if (addSessions && membership.sessionsTotal !== null) {
    updateData.sessionsTotal = membership.sessionsTotal + addSessions;
    updateData.status = "ACTIVE";
  }
  if (directUpdates.expiresAt) {
    updateData.expiresAt = new Date(directUpdates.expiresAt as string);
  }

  const updated = await db.membership.update({
    where: { id },
    data: updateData,
    include: { plan: true, user: { select: { id: true, name: true, email: true } } },
  });

  return ok(updated);
}
