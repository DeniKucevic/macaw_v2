/**
 * Admin polls this while enrolling a card: returns the most recent scanned UID
 * newer than `since`, so tapping a card on the reader auto-fills the tag field.
 * Session-authed (OWNER/STAFF), scoped to the caller's gym.
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { deviceId } = await params;

  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller || (caller.role !== Role.OWNER && caller.role !== Role.STAFF)) {
    return forbidden();
  }

  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device || device.gymId !== caller.gymId) return notFound("Device");

  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60000);

  const scan = await db.deviceLog.findFirst({
    where: { deviceId, level: "SCAN", createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
  });

  return ok({ tagId: scan?.tagId ?? null, at: scan?.createdAt ?? null });
}
