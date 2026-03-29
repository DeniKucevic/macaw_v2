import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddMemberDialog } from "./add-member-dialog";
import { format } from "date-fns";
import { MembershipStatus } from "@/generated/prisma/client";

const roleLabel: Record<string, string> = {
  OWNER: "Vlasnik",
  STAFF: "Osoblje",
  MEMBER: "Član",
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const search = q?.trim() ?? "";

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
    orderBy: { createdAt: "desc" },
  });

  const allCount = await db.user.count({ where: { gymId: user.gymId } });
  const activeCount = await db.membership.count({
    where: { gymId: user.gymId, status: MembershipStatus.ACTIVE },
  });
  const staffCount = await db.user.count({
    where: { gymId: user.gymId, role: { in: ["STAFF", "OWNER"] } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Članovi</h1>
          <p className="text-muted-foreground text-sm">
            {allCount} ukupno · {activeCount} sa aktivnom članarinomom
          </p>
        </div>
        <AddMemberDialog />
      </div>

      <div className="grid grid-cols-3 gap-4">
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
      </div>

      <Card>
        <div className="p-4 border-b">
          <form method="GET">
            <Input
              name="q"
              defaultValue={search}
              placeholder="Pretraži po imenu, emailu ili telefonu…"
              className="max-w-sm"
            />
          </form>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ime</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Uloga</TableHead>
              <TableHead>Članarina</TableHead>
              <TableHead>Učlanjen</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const activeMembership = member.memberships[0];
              return (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell className="text-muted-foreground">{member.email}</TableCell>
                  <TableCell>
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
                        {activeMembership.plan.type === "TIME_BASED" && activeMembership.expiresAt && (
                          <span className="text-muted-foreground ml-1">
                            (ist. {format(activeMembership.expiresAt, "dd.MM")})
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Bez članarine</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(member.createdAt, "dd.MM.yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/members/${member.id}`}>Pregled</Link>
                    </Button>
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
