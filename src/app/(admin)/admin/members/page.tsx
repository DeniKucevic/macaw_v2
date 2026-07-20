import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddMemberDialog } from "./add-member-dialog";
import { MembersControls } from "./members-controls";
import { fmtDate, fmtDayMonth, DEFAULT_TZ } from "@/lib/time";
import { MembershipStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";


const roleLabel: Record<string, string> = {
  OWNER: "Vlasnik",
  STAFF: "Osoblje",
  MEMBER: "Član",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const gymTz = await db.gym.findUnique({ where: { id: user.gymId }, select: { timezone: true } });
  const tz = gymTz?.timezone || DEFAULT_TZ;

  const { q, sort } = await searchParams;
  const search = q?.trim() ?? "";

  // name / newest / oldest sort in the DB; "expiry" is sorted in JS below
  // because it depends on the (filtered, take-1) active membership relation.
  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "name"
      ? { name: "asc" }
      : sort === "oldest"
        ? { createdAt: "asc" }
        : { createdAt: "desc" };

  const members = await db.user.findMany({
    where: {
      gymId: user.gymId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      memberships: {
        where: { status: MembershipStatus.ACTIVE },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy,
  });

  if (sort === "expiry") {
    // Soonest-expiring first; members without a dated membership go last.
    members.sort((a, b) => {
      const ea = a.memberships[0]?.expiresAt?.getTime() ?? Infinity;
      const eb = b.memberships[0]?.expiresAt?.getTime() ?? Infinity;
      return ea - eb;
    });
  }

  const allCount = await db.user.count({ where: { gymId: user.gymId } });
  const activeCount = await db.membership.count({
    where: { gymId: user.gymId, status: MembershipStatus.ACTIVE },
  });
  const staffCount = await db.user.count({
    where: { gymId: user.gymId, role: { in: ["STAFF", "OWNER"] } },
  });

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const expiringCount = await db.membership.count({
    where: {
      gymId: user.gymId,
      status: MembershipStatus.ACTIVE,
      plan: { type: "TIME_BASED" },
      expiresAt: { gte: new Date(), lte: in7Days },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Članovi</h1>
          <p className="text-muted-foreground text-sm">
            {allCount} ukupno · {activeCount} sa aktivnom članarinom
          </p>
        </div>
        <AddMemberDialog />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ukupno članova</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{allCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktivne članarine</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{activeCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Osoblje</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{staffCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ističe uskoro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${expiringCount > 0 ? "text-orange-500" : ""}`}>{expiringCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b">
          <MembersControls />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ime</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden sm:table-cell">Uloga</TableHead>
              <TableHead>Članarina</TableHead>
              <TableHead className="hidden lg:table-cell">Učlanjen</TableHead>
              <TableHead className="hidden sm:table-cell">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const activeMembership = member.memberships[0];
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="hover:text-brand transition-colors"
                    >
                      {member.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{member.email}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={member.role === "MEMBER" ? "secondary" : "default"}>
                      {roleLabel[member.role] ?? member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {activeMembership ? (
                      <div className="text-sm">
                        <span className="font-medium">{activeMembership.plan.name}</span>
                        {activeMembership.plan.type === "SESSION_BASED" && (
                          <span className="text-muted-foreground ml-1">
                            ({(activeMembership.sessionsTotal ?? 0) - (activeMembership.sessionsUsed ?? 0)} preostalo)
                          </span>
                        )}
                        {activeMembership.plan.type === "TIME_BASED" && activeMembership.expiresAt && (() => {
                          const daysLeft = Math.ceil((activeMembership.expiresAt.getTime() - Date.now()) / 86400000);
                          const soon = daysLeft <= 7;
                          return (
                            <span className={soon ? "text-orange-500 font-medium ml-1" : "text-muted-foreground ml-1"}>
                              (ist. {fmtDayMonth(activeMembership.expiresAt, tz)}{soon ? ` · ${daysLeft}d` : ""})
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Bez članarine</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {fmtDate(member.createdAt, tz)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="text-sm font-medium text-foreground hover:text-brand transition-colors"
                    >
                      Pregled
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {search ? `Nema članova za „${search}"` : "Nema članova. Dodajte prvog člana."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
