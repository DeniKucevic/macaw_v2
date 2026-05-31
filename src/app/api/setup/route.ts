/**
 * One-time setup endpoint to create the first gym and owner account.
 * Disabled once any gym exists.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SetupSchema = z.object({
  setupSecret: z.string().min(1),
  gymName: z.string().min(1),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const { setupSecret, gymName, ownerName, ownerEmail, ownerPassword } = parsed.data;

  const expectedSecret = process.env.SETUP_SECRET;
  if (!expectedSecret || setupSecret !== expectedSecret) {
    return err("Invalid setup secret", 403);
  }

  const count = await db.gym.count();
  if (count > 0) {
    return err("Setup already completed", 403);
  }

  const slug = gymName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  // Create everything in one transaction
  const result = await db.$transaction(async (tx) => {
    const gym = await tx.gym.create({
      data: { name: gymName, slug },
    });

    const userId = randomBytes(12).toString("hex");

    const user = await tx.user.create({
      data: {
        id: userId,
        name: ownerName,
        email: ownerEmail,
        emailVerified: true,
        role: "OWNER",
        gymId: gym.id,
      },
    });

    // Better Auth stores credentials in the Account table with providerId="credential"
    await tx.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    return { gym, user };
  });

  return ok({
    gym: { id: result.gym.id, name: result.gym.name, slug: result.gym.slug },
    owner: { id: result.user.id, email: ownerEmail },
    message: "Setup complete. You can now log in.",
  }, 201);
}
