#!/usr/bin/env npx tsx
/**
 * Seed a TEST member with an active membership and realistic visit history, so
 * you can log in as a member and see the client view (and build member stats).
 *
 *   DATABASE_URL="<your-supabase-url>" npx tsx scripts/seed-test-member.ts
 *
 * Login:  username "test" / password "test1234"  (override via TEST_USERNAME /
 * TEST_PASSWORD / TEST_NAME env vars).
 *
 * Idempotent: re-running reuses the user and REGENERATES its membership+entries.
 * It only ever touches this one test user — real members are untouched.
 *
 * ⚠️ This writes to whatever DATABASE_URL points at. Against production Supabase,
 * the fake entries WILL show up in the admin Evidencija/Statistika until you run
 * scripts/remove-test-member.ts.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SUPABASE_CA_CERT } from "../src/lib/supabase-ca";
import bcrypt from "bcryptjs";

// Same TLS handling as src/lib/db.ts (Supabase pooler needs its pinned CA).
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.delete("sslmode");
url.searchParams.delete("pgbouncer");
const host = url.hostname;
const ssl =
  host === "localhost" || host === "127.0.0.1"
    ? undefined
    : host.endsWith(".supabase.com")
      ? { ca: SUPABASE_CA_CERT, rejectUnauthorized: true }
      : { rejectUnauthorized: true };
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url.toString(), ssl }),
});

const USERNAME = process.env.TEST_USERNAME ?? "test";
const PASSWORD = process.env.TEST_PASSWORD ?? "test1234";
const NAME = process.env.TEST_NAME ?? "Test Korisnik";

type DayCfg = { isOpen: boolean; open: string; close: string };
// JS getDay(): 0=Sun..6=Sat → the hours-config keys.
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

async function main() {
  const gym = await db.gym.findFirst();
  if (!gym) throw new Error("No gym found — run setup first.");

  // Reuse an active plan, or make a simple monthly one for the test.
  let plan = await db.membershipPlan.findFirst({
    where: { gymId: gym.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!plan) {
    plan = await db.membershipPlan.create({
      data: {
        gymId: gym.id,
        name: "Test mesečna",
        type: "TIME_BASED",
        durationMonths: 1,
        price: 0,
        maxPerDay: 1,
      },
    });
    console.log(`+ created test plan "${plan.name}"`);
  }

  // Create or reuse the test user (+ credential account for Better Auth login).
  let user = await db.user.findUnique({ where: { username: USERNAME } });
  if (!user) {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: NAME,
          username: USERNAME,
          displayUsername: USERNAME,
          role: "MEMBER",
          gymId: gym.id,
          emailVerified: false,
        },
      });
      await tx.account.create({
        data: {
          accountId: u.id,
          providerId: "credential",
          userId: u.id,
          password: passwordHash,
        },
      });
      return u;
    });
    console.log(`+ created member "${NAME}" (login: ${USERNAME} / ${PASSWORD})`);
  } else {
    console.log(`✓ member "${USERNAME}" exists — regenerating its data`);
  }

  // Fresh slate for this user's membership + entries.
  await db.entry.deleteMany({ where: { userId: user.id } });
  await db.membership.deleteMany({ where: { userId: user.id } });

  const now = new Date();
  const membership = await db.membership.create({
    data: {
      gymId: gym.id,
      userId: user.id,
      planId: plan.id,
      status: "ACTIVE",
      startsAt: new Date(now.getTime() - 60 * 86400000),
      maxPerDay: plan.maxPerDay,
      ...(plan.type === "TIME_BASED"
        ? { expiresAt: new Date(now.getTime() + 30 * 86400000) }
        : { sessionsTotal: plan.sessionCount ?? 20, sessionsUsed: 8 }),
    },
  });

  // Realistic visits over the last 60 days: open days only, within open hours,
  // skewed toward the evening, ~55% of open days, mostly RFID with some app.
  const hours = (gym.hours as unknown as Record<string, DayCfg> | null) ?? null;
  const rows: { enteredAt: Date; method: "RFID" | "PHONE" }[] = [];
  for (let d = 60; d >= 0; d--) {
    const day = new Date(now.getTime() - d * 86400000);
    const cfg = hours?.[DAY_KEYS[day.getDay()]];
    const isOpen = hours ? cfg?.isOpen ?? false : true;
    if (!isOpen) continue;
    if (Math.random() > 0.55) continue; // didn't come in that day

    const openH = cfg ? parseInt(cfg.open.split(":")[0], 10) : 7;
    const closeH = cfg ? parseInt(cfg.close.split(":")[0], 10) : 22;
    const span = Math.max(1, closeH - openH - 1);
    const hour = openH + Math.min(span, Math.floor(Math.pow(Math.random(), 0.6) * span));
    const enteredAt = new Date(day);
    enteredAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
    rows.push({ enteredAt, method: Math.random() < 0.7 ? "RFID" : "PHONE" });
  }

  await db.entry.createMany({
    data: rows.map((r) => ({
      gymId: gym.id,
      userId: user!.id,
      membershipId: membership.id,
      method: r.method,
      enteredAt: r.enteredAt,
    })),
  });

  console.log(`✓ created ${rows.length} fake entries over ~60 days`);
  console.log(`\n➡  Log in at /login as:  ${USERNAME} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
