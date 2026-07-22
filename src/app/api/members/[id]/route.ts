import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { looksLikeEmail, normalizeUsername } from "@/lib/username";

const UpdateMemberSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim() || null)),
  role: z.enum(["MEMBER", "STAFF"]).optional(),
  // The login handle: an email (has "@") or a username. Optional here — only
  // present when staff is changing how the member signs in.
  identifier: z.string().min(1).optional(),
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

  const { identifier, ...rest } = parsed.data;
  const data: {
    name?: string;
    phone?: string | null;
    role?: "MEMBER" | "STAFF";
    email?: string | null;
    username?: string | null;
    displayUsername?: string | null;
  } = { ...rest };

  // Changing the login handle: route to the email or username column (clearing
  // the other), enforcing uniqueness against everyone except this member.
  let handleChanged = false;
  if (identifier !== undefined) {
    const handle = identifier.trim();
    if (looksLikeEmail(handle)) {
      const email = handle.toLowerCase();
      const clash = await db.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
      if (clash) return err("Član sa ovom email adresom već postoji", 409);
      data.email = email;
      data.username = null;
      data.displayUsername = null;
    } else {
      const username = normalizeUsername(handle);
      if (username.length < 3) {
        return err("Korisničko ime mora imati bar 3 znaka (slova, brojevi, . _ -)", 400);
      }
      const clash = await db.user.findFirst({ where: { username, id: { not: id } }, select: { id: true } });
      if (clash) return err(`Korisničko ime „${handle}" je već zauzeto`, 409);
      data.username = username;
      data.displayUsername = handle;
      data.email = null;
    }
    handleChanged = true;
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      displayUsername: true,
      phone: true,
      role: true,
      updatedAt: true,
    },
  });

  const roleChanged = !!parsed.data.role && parsed.data.role !== target.role;
  await logAudit({
    gymId: staff.gymId,
    actorId: staff.id,
    actorName: staff.name,
    action: roleChanged ? "MEMBER_ROLE_CHANGED" : "MEMBER_UPDATED",
    targetType: "User",
    targetId: id,
    targetLabel: updated.name,
    details: roleChanged
      ? { from: target.role, to: parsed.data.role }
      : handleChanged
        ? { handle: updated.email ?? updated.displayUsername }
        : { ...rest },
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
  await logAudit({
    gymId: caller.gymId,
    actorId: caller.id,
    actorName: caller.name,
    action: "MEMBER_DELETED",
    targetType: "User",
    targetId: id,
    targetLabel: target.name,
    details: { handle: target.email ?? target.displayUsername, role: target.role },
  });
  return ok({ deleted: true });
}
