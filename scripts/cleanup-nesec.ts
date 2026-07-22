// One-off cleanup: permanently removes the junk "Nesec" plan and ONLY the test
// data attached to it (its memberships + their entries). Touches no other plan.
// Run from the project root:  npx tsx scripts/cleanup-nesec.ts
// Safe to delete this file afterwards.
import "dotenv/config";
import { db } from "@/lib/db";

async function main() {
  const plan = await db.membershipPlan.findFirst({
    where: { name: "Nesec" },
    select: { id: true, name: true },
  });
  if (!plan) {
    console.log("No 'Nesec' plan found (already deleted?). Nothing to do.");
    return;
  }

  const memberships = await db.membership.findMany({
    where: { planId: plan.id },
    select: { id: true },
  });
  const mIds = memberships.map((m) => m.id);

  await db.$transaction(async (tx) => {
    const entries = await tx.entry.deleteMany({ where: { membershipId: { in: mIds } } });
    const mems = await tx.membership.deleteMany({ where: { id: { in: mIds } } });
    await tx.membershipPlan.delete({ where: { id: plan.id } });
    console.log(
      `Deleted plan "${plan.name}": ${entries.count} entr(y/ies), ${mems.count} membership(s), 1 plan.`
    );
  });

  const remaining = await db.membershipPlan.findMany({ select: { name: true } });
  console.log("Remaining plans:", remaining.map((p) => p.name).join(", ") || "(none)");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
