import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import { randomBytes } from "crypto";

const CreateDeviceSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== Role.OWNER) return forbidden();

  const devices = await db.device.findMany({
    where: { gymId: user.gymId },
    orderBy: { createdAt: "desc" },
  });

  return ok(devices);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== Role.OWNER) return forbidden();

  const body = await req.json();
  const parsed = CreateDeviceSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const secret = randomBytes(32).toString("hex");

  const device = await db.device.create({
    data: {
      gymId: user.gymId,
      name: parsed.data.name,
      secret,
    },
    select: {
      id: true,
      name: true,
      secret: true,
      createdAt: true,
    },
  });

  return ok(device, 201);
}
