import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

const AddRfidSchema = z.object({
  tagId: z.string().min(1),
  label: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || (caller.role !== Role.OWNER && caller.role !== Role.STAFF)) {
    return forbidden();
  }

  const { id } = await params;
  const member = await db.user.findUnique({ where: { id } });
  if (!member || member.gymId !== caller.gymId) return err("Član nije pronađen", 404);

  const body = await req.json();
  const parsed = AddRfidSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const existing = await db.rfidTag.findUnique({ where: { tagId: parsed.data.tagId } });
  if (existing) return err("Ova kartica je već registrovana", 409);

  const tag = await db.rfidTag.create({
    data: {
      tagId: parsed.data.tagId,
      label: parsed.data.label,
      userId: id,
      isActive: true,
    },
  });

  return ok(tag, 201);
}
