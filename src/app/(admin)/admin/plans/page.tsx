import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddPlanDialog } from "./add-plan-dialog";

export default async function PlansPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const plans = await db.membershipPlan.findMany({
    where: { gymId: user.gymId },
    include: {
      _count: { select: { memberships: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

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
              <TableHead>Tip</TableHead>
              <TableHead>Trajanje / Treninzi</TableHead>
              <TableHead>Cena</TableHead>
              <TableHead>Maks./Dan</TableHead>
              <TableHead>Članovi</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell>
                  <Badge variant="outline">
                    {plan.type === "TIME_BASED" ? "Vremenski" : "Treninzi"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {plan.type === "TIME_BASED"
                    ? `${plan.durationDays} dana`
                    : `${plan.sessionCount} treninga`}
                </TableCell>
                <TableCell className="font-medium">
                  {String(plan.price)} {plan.currency}
                </TableCell>
                <TableCell>{plan.maxPerDay}x</TableCell>
                <TableCell className="text-muted-foreground">{plan._count.memberships}</TableCell>
                <TableCell>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Aktivan" : "Neaktivan"}
                  </Badge>
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
