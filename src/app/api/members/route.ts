import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { generateUniquePin } from "@/lib/pin";

const CreateMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["MEMBER", "STAFF"]).default("MEMBER"),
  password: z.string().min(6),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || (user.role !== Role.OWNER && user.role !== Role.STAFF)) {
    return forbidden();
  }

  const members = await db.user.findMany({
    where: { gymId: user.gymId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      memberships: {
        where: { status: "ACTIVE" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(members);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const owner = await db.user.findUnique({ where: { id: session.user.id } });
  if (!owner || (owner.role !== Role.OWNER && owner.role !== Role.STAFF)) {
    return forbidden();
  }

  const body = await req.json();
  const parsed = CreateMemberSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { name, email, phone, role, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return err("A user with this email already exists", 409);

  const passwordHash = await bcrypt.hash(password, 12);
  const pin = await generateUniquePin(owner.gymId);

  const newUser = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        phone,
        role,
        gymId: owner.gymId,
        emailVerified: false,
        pin,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    await tx.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    return user;
  });

  return ok({ ...newUser, pin }, 201);
}
