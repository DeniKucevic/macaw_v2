import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden, notFound } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { validateAndRecordEntry } from "@/lib/entry-logic";

const ManualEntrySchema = z.object({
  userId: z.string(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return unauthorized();

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  if (user.role === Role.MEMBER) {
    const entries = await db.entry.findMany({
      where: { gymId: user.gymId, userId: user.id },
      include: { membership: { include: { plan: true } } },
      orderBy: { enteredAt: "desc" },
      take: limit,
      skip: offset,
    });
    return ok(entries);
  }

  const where = memberId
    ? { gymId: user.gymId, userId: memberId }
    : { gymId: user.gymId };

  const [entries, total] = await Promise.all([
    db.entry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        membership: { include: { plan: true } },
      },
      orderBy: { enteredAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.entry.count({ where }),
  ]);

  return ok({ entries, total });
}

// Manual entry by staff
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const staff = await db.user.findUnique({ where: { id: session.user.id } });
  if (!staff || (staff.role !== Role.OWNER && staff.role !== Role.STAFF)) {
    return forbidden();
  }

  const body = await req.json();
  const parsed = ManualEntrySchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const target = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target || target.gymId !== staff.gymId) return notFound("Member");

  const result = await validateAndRecordEntry(
    staff.gymId,
    parsed.data.userId,
    "MANUAL",
    true,
    parsed.data.notes
  );

  if (!result.allowed) return err(result.reason, 422);

  return ok(result, 201);
}
