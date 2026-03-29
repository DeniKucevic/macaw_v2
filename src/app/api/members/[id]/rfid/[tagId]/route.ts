import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || (caller.role !== Role.OWNER && caller.role !== Role.STAFF)) {
    return forbidden();
  }

  const { id, tagId } = await params;
  const member = await db.user.findUnique({ where: { id } });
  if (!member || member.gymId !== caller.gymId) return err("Član nije pronađen", 404);

  const tag = await db.rfidTag.findUnique({ where: { id: tagId } });
  if (!tag || tag.userId !== id) return err("Kartica nije pronađena", 404);

  await db.rfidTag.delete({ where: { id: tagId } });

  return ok({ deleted: true });
}
