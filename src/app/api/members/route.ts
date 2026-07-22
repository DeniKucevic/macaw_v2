import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, err, unauthorized, forbidden } from "@/lib/api-helpers";
import { Role } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { looksLikeEmail, normalizeUsername } from "@/lib/username";

const CreateMemberSchema = z.object({
  name: z.string().min(1),
  // The login handle: an email (contains "@") or a username (no "@"). Exactly
  // one is required; the API routes it to the email or username column.
  identifier: z.string().min(1),
  // Empty / whitespace-only phone is stored as NULL, never "", so the
  // (gymId, phone) uniqueness constraint doesn't treat blanks as duplicates.
  phone: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : undefined;
    }),
  role: z.enum(["MEMBER", "STAFF"]).default("MEMBER"),
  // Short is allowed on purpose — staff set a simple starter password (e.g.
  // "12345") that the member can change later.
  password: z.string().min(4),
  // Set true to create even though a member with the same name exists (the
  // client shows a "possible duplicate" confirm before re-submitting).
  force: z.boolean().optional(),
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
      username: true,
      displayUsername: true,
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

  const { name, identifier, phone, role, password, force } = parsed.data;

  // Route the single login handle to the right column, with a uniqueness check.
  const handle = identifier.trim();
  let email: string | null = null;
  let username: string | null = null;
  let displayUsername: string | null = null;

  if (looksLikeEmail(handle)) {
    email = handle.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return err("Član sa ovom email adresom već postoji", 409);
  } else {
    username = normalizeUsername(handle);
    if (username.length < 3) {
      return err("Korisničko ime mora imati bar 3 znaka (slova, brojevi, . _ -)", 400);
    }
    displayUsername = handle;
    const existing = await db.user.findUnique({ where: { username } });
    if (existing) return err(`Korisničko ime „${handle}" je već zauzeto`, 409);
  }

  // A phone number is unique per person, so it's the strongest dedup signal.
  // This block is non-overridable: two different people never share a number.
  if (phone) {
    const samePhone = await db.user.findFirst({
      where: { gymId: owner.gymId, phone },
      select: { id: true, name: true },
    });
    if (samePhone) {
      return err(
        `Član „${samePhone.name}" već koristi ovaj broj telefona`,
        409
      );
    }
  }

  // A name match is only a soft signal (people share names), so the client can
  // confirm and re-submit with force:true. Surfaces likely duplicates.
  if (!force) {
    const sameName = await db.user.findMany({
      where: { gymId: owner.gymId, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true, name: true, phone: true, email: true, displayUsername: true },
      take: 5,
    });
    if (sameName.length > 0) {
      return Response.json(
        { error: "DUPLICATE_NAME", code: "DUPLICATE_NAME", existing: sameName },
        { status: 409 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newUser = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        username,
        displayUsername,
        phone,
        role,
        gymId: owner.gymId,
        emailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        displayUsername: true,
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

  await logAudit({
    gymId: owner.gymId,
    actorId: owner.id,
    actorName: owner.name,
    action: "MEMBER_CREATED",
    targetType: "User",
    targetId: newUser.id,
    targetLabel: newUser.name,
    details: { handle: newUser.email ?? newUser.displayUsername, role: newUser.role },
  });

  return ok(newUser, 201);
}
