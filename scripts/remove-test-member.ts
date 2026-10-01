#!/usr/bin/env npx tsx
/**
 * Remove the test member created by seed-test-member.ts, along with its entries,
 * memberships and login — so the fake data stops showing in admin stats.
 *
 *   DATABASE_URL="<your-supabase-url>" npx tsx scripts/remove-test-member.ts
 *
 * Targets only the user with username TEST_USERNAME (default "test").
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SUPABASE_CA_CERT } from "../src/lib/supabase-ca";

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

async function main() {
  const user = await db.user.findUnique({ where: { username: USERNAME } });
  if (!user) {
    console.log(`No user "${USERNAME}" — nothing to remove.`);
    return;
  }
  if (user.role !== "MEMBER") {
    throw new Error(`Refusing to delete "${USERNAME}" — role is ${user.role}, not MEMBER.`);
  }

  await db.entry.deleteMany({ where: { userId: user.id } });
  await db.membership.deleteMany({ where: { userId: user.id } });
  await db.account.deleteMany({ where: { userId: user.id } });
  await db.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await db.user.delete({ where: { id: user.id } });

  console.log(`✓ removed test member "${USERNAME}" and all its data.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
