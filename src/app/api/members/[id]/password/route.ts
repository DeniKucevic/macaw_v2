/**
 * Admin password reset. An OWNER/STAFF sets a new password for a member of their
 * gym, without needing the old one. Updates the better-auth "credential" account
 * directly, using the same bcrypt cost (12) configured in src/lib/auth.ts so the
 * new password verifies on login.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

const ResetSchema = z.object({ password: z.string().min(6) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || (caller.role !== Role.OWNER && caller.role !== Role.STAFF)) {
    return forbidden();
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.gymId !== caller.gymId) return notFound("Član");

  const body = await req.json();
  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const credential = await db.account.findFirst({
    where: { userId: id, providerId: "credential" },
  });
  if (!credential) return err("Član nema lozinku za prijavu", 400);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.account.update({
    where: { id: credential.id },
    data: { password: passwordHash },
  });

  return ok({ success: true });
}
