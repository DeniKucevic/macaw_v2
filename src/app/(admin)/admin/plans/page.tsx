import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddPlanDialog } from "./add-plan-dialog";
import { DeletePlanButton } from "./delete-plan-button";
import { MembershipStatus } from "@/generated/prisma/client";

export default async function PlansPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const now = new Date();
  const plans = await db.membershipPlan.findMany({
    where: { gymId: user.gymId },
    include: {
      // "Članovi" = truly active: status ACTIVE and not past its expiry
      // (time-based plans have expiresAt; session-based have it null).
      _count: {
        select: {
          memberships: {
            where: {
              status: MembershipStatus.ACTIVE,
              OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  // Total memberships per plan (any status) — used for delete-vs-deactivate
  // messaging, since expired/suspended rows still block a hard delete (FK).
  const totals = await db.membership.groupBy({
    by: ["planId"],
    where: { gymId: user.gymId },
    _count: { _all: true },
  });
  const totalByPlan = new Map(totals.map((t) => [t.planId, t._count._all]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planovi članarine</h1>
          <p className="text-muted-foreground text-sm">{plans.length} planova definisano</p>
        </div>
        <AddPlanDialog />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv plana</TableHead>
              <TableHead className="hidden sm:table-cell">Tip</TableHead>
              <TableHead className="hidden lg:table-cell">Trajanje / Treninzi</TableHead>
              <TableHead>Cena</TableHead>
              <TableHead className="hidden lg:table-cell">Maks./Dan</TableHead>
              <TableHead className="hidden md:table-cell">Članovi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">
                  {plan.name}
                  {plan.description && (
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">
                    {plan.type === "TIME_BASED" ? "Vremenski" : "Treninzi"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {plan.type === "TIME_BASED"
                    ? `${plan.durationDays} dana`
                    : `${plan.sessionCount} treninga`}
                </TableCell>
                <TableCell className="font-medium">
                  {String(plan.price)} {plan.currency}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{plan.maxPerDay}x</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{plan._count.memberships}</TableCell>
                <TableCell>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Aktivan" : "Neaktivan"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DeletePlanButton planId={plan.id} membershipCount={totalByPlan.get(plan.id) ?? 0} />
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  Nema planova. Kreirajte prvi plan članarine.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
