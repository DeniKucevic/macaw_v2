import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

const UpdateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["MEMBER", "STAFF"]).optional(),
});

async function getStaffUser(sessionUserId: string) {
  const user = await db.user.findUnique({ where: { id: sessionUserId } });
  if (!user || (user.role !== Role.OWNER && user.role !== Role.STAFF)) return null;
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller) return unauthorized();

  // Members can only see themselves
  if (caller.role === Role.MEMBER && caller.id !== id) return forbidden();

  const member = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      gymId: true,
      createdAt: true,
      memberships: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
      entries: {
        include: { membership: { include: { plan: true } } },
        orderBy: { enteredAt: "desc" },
        take: 50,
      },
      rfidTags: true,
    },
  });

  if (!member || member.gymId !== caller.gymId) return notFound("Member");

  return ok(member);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const staff = await getStaffUser(session.user.id);
  if (!staff) return forbidden();

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.gymId !== staff.gymId) return notFound("Member");

  const body = await req.json();
  const parsed = UpdateMemberSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const updated = await db.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      updatedAt: true,
    },
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

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || caller.role !== Role.OWNER) return forbidden();

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.gymId !== caller.gymId) return notFound("Member");
  if (target.role === Role.OWNER) return err("Cannot delete the owner", 400);

  await db.user.delete({ where: { id } });
  return ok({ deleted: true });
}
