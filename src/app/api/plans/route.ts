import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";

const CreatePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["TIME_BASED", "SESSION_BASED"]),
  durationDays: z.number().int().positive().optional(),
  sessionCount: z.number().int().positive().optional(),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("EUR"),
  maxPerDay: z.number().int().positive().default(1),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return unauthorized();

  const plans = await db.membershipPlan.findMany({
    where: { gymId: user.gymId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return ok(plans);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== Role.OWNER) return forbidden();

  const body = await req.json();
  const parsed = CreatePlanSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { type, durationDays, sessionCount } = parsed.data;
  if (type === "TIME_BASED" && !durationDays) {
    return err("durationDays required for TIME_BASED plans");
  }
  if (type === "SESSION_BASED" && !sessionCount) {
    return err("sessionCount required for SESSION_BASED plans");
  }

  const plan = await db.membershipPlan.create({
    data: {
      ...parsed.data,
      gymId: user.gymId,
      price: parsed.data.price,
    },
  });

  return ok(plan, 201);
}
