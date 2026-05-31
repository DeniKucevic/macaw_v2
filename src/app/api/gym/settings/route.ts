import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

const DaySchema = z.object({
  isOpen: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
});

const HoursSchema = z.object({
  mon: DaySchema,
  tue: DaySchema,
  wed: DaySchema,
  thu: DaySchema,
  fri: DaySchema,
  sat: DaySchema,
  sun: DaySchema,
});

const UpdateSettingsSchema = z.object({
  hours: HoursSchema.nullable().optional(),
  timezone: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || (user.role !== Role.OWNER && user.role !== Role.STAFF)) {
    return forbidden();
  }

  const gym = await db.gym.findUnique({
    where: { id: user.gymId },
    select: { hours: true, timezone: true },
  });

  return ok(gym);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== Role.OWNER) return forbidden();

  const body = await req.json();
  const parsed = UpdateSettingsSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const data: Record<string, unknown> = {};
  if ("hours" in parsed.data) data.hours = parsed.data.hours;
  if (parsed.data.timezone) data.timezone = parsed.data.timezone;

  const gym = await db.gym.update({
    where: { id: user.gymId },
    data,
    select: { hours: true, timezone: true },
  });

  return ok(gym);
}
