import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

const UpdatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().nonnegative().optional(),
  maxPerDay: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== Role.OWNER) return forbidden();

  const plan = await db.membershipPlan.findUnique({ where: { id } });
  if (!plan || plan.gymId !== user.gymId) return notFound("Plan");

  const body = await req.json();
  const parsed = UpdatePlanSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await db.membershipPlan.update({
    where: { id },
    data: parsed.data,
  });

  return ok(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== Role.OWNER) return forbidden();

  const plan = await db.membershipPlan.findUnique({ where: { id } });
  if (!plan || plan.gymId !== user.gymId) return notFound("Plan");

  // Soft delete - just deactivate
  const updated = await db.membershipPlan.update({
    where: { id },
    data: { isActive: false },
  });

  return ok(updated);
}
