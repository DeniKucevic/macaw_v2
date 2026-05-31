import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { generateUniquePin } from "@/lib/pin";

export async function POST(
  _req: NextRequest,
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

  const pin = await generateUniquePin(caller.gymId);

  await db.user.update({
    where: { id },
    data: { pin },
  });

  return ok({ pin });
}
