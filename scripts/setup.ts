#!/usr/bin/env npx tsx
/**
 * Run this script to create your first gym and owner account:
 *
 *   npx tsx scripts/setup.ts
 *
 * Or via the API after starting the server:
 *   POST /api/setup { gymName, ownerName, ownerEmail, ownerPassword }
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  const count = await db.gym.count();
  if (count > 0) {
    console.log("✓ Gym already exists. Nothing to do.");
    return;
  }

  // You can change these or accept from environment variables
  const gymName = process.env.GYM_NAME ?? "My Gym";
  const ownerName = process.env.OWNER_NAME ?? "Owner";
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;

  if (!ownerEmail || !ownerPassword) {
    console.error("❌ Set OWNER_EMAIL and OWNER_PASSWORD in .env or environment");
    process.exit(1);
  }

  const slug = gymName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const gym = await db.gym.create({ data: { name: gymName, slug } });

  console.log(`✓ Gym created: "${gym.name}" (slug: ${gym.slug})`);
  console.log("");
  console.log("Next step: Start the server and POST to /api/setup to create the owner account.");
  console.log("Or use the /api/setup endpoint from your browser/curl:");
  console.log(JSON.stringify({
    gymName,
    ownerName,
    ownerEmail,
    ownerPassword: "your-password",
  }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
