import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
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
import { fmtDate, fmtDateTime, DEFAULT_TZ } from "@/lib/time";
import { AssignMembershipDialog } from "./assign-membership-dialog";
import { ManualEntryButton } from "./manual-entry-button";
import { EditMembershipDialog } from "./edit-membership-dialog";
import { RfidSection } from "./rfid-section";
import { ResetPasswordButton } from "./reset-password-button";
import { MembershipStatus } from "@/generated/prisma/client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
  PIN: "PIN",
};

const roleLabel: Record<string, string> = {
  OWNER: "Vlasnik",
  STAFF: "Osoblje",
  MEMBER: "Član",
};

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const caller = await db.user.findUnique({ where: { id: session.user.id } });
  if (!caller) redirect("/login");

  const member = await db.user.findUnique({
    where: { id },
    include: {
      memberships: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
      entries: {
        include: { membership: { include: { plan: true } } },
        orderBy: { enteredAt: "desc" },
        take: 30,
      },
      rfidTags: true,
    },
  });

  if (!member || member.gymId !== caller.gymId) notFound();

  const rawActiveMembership = member.memberships.find(
    (m) => m.status === MembershipStatus.ACTIVE
  );
  // Serialize Decimal on nested plan so client components can receive it
  const activeMembership = rawActiveMembership
    ? { ...rawActiveMembership, plan: { ...rawActiveMembership.plan, price: rawActiveMembership.plan.price.toString() } }
    : undefined;

  const rawPlans = await db.membershipPlan.findMany({
    where: { gymId: caller.gymId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  // Serialize Decimal → string so it can be passed to Client Components
  const plans = rawPlans.map((p) => ({ ...p, price: p.price.toString() }));

  // Reader used to capture card UIDs during enrollment (gym's first device).
  const device = await db.device.findFirst({
    where: { gymId: caller.gymId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const gym = await db.gym.findUnique({
    where: { id: caller.gymId },
    select: { timezone: true },
  });
  const tz = gym?.timezone || DEFAULT_TZ;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/admin/members"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold break-words">{member.name}</h1>
          <p className="text-muted-foreground text-sm break-words">{member.email ?? member.displayUsername ?? "—"} · {member.phone ?? "bez telefona"}</p>
        </div>
        <Badge className="shrink-0">{roleLabel[member.role] ?? member.role}</Badge>
      </div>

      {/* Aktivna članarina */}
      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Aktivna članarina</CardTitle>
          <div className="flex flex-wrap gap-2">
            {activeMembership && (
              <>
                <ManualEntryButton memberId={member.id} memberName={member.name} />
                <EditMembershipDialog membership={activeMembership} />
              </>
            )}
            <AssignMembershipDialog memberId={member.id} plans={plans} />
          </div>
        </CardHeader>
        <CardContent>
          {activeMembership ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="font-medium">{activeMembership.plan.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tip</p>
                <p className="font-medium">{activeMembership.plan.type === "TIME_BASED" ? "Vremenski" : "Po treninzima"}</p>
              </div>
              {activeMembership.plan.type === "SESSION_BASED" && (
                <div>
                  <p className="text-xs text-muted-foreground">Preostalo treninga</p>
                  <p className="font-medium text-lg">
                    {(activeMembership.sessionsTotal ?? 0) - (activeMembership.sessionsUsed ?? 0)}
                    <span className="text-muted-foreground text-sm"> / {activeMembership.sessionsTotal}</span>
                  </p>
                </div>
              )}
              {activeMembership.plan.type === "TIME_BASED" && activeMembership.expiresAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Ističe</p>
                  <p className="font-medium">{fmtDate(activeMembership.expiresAt, tz)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Počelo</p>
                <p className="font-medium">{fmtDate(activeMembership.startsAt, tz)}</p>
              </div>
              {activeMembership.notes && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-muted-foreground">Napomena</p>
                  <p className="font-medium whitespace-pre-wrap break-words">{activeMembership.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Nema aktivne članarine. Dodelite je pomoću dugmeta iznad.</p>
          )}
        </CardContent>
      </Card>

      {/* RFID kartice */}
      <RfidSection memberId={member.id} initialTags={member.rfidTags} deviceId={device?.id ?? null} />

      {/* Lozinka */}
      <ResetPasswordButton memberId={member.id} memberName={member.name} />

      {/* Istorija ulazaka */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nedavni ulasci</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum i vreme</TableHead>
              <TableHead>Metod</TableHead>
              <TableHead className="hidden md:table-cell">Plan</TableHead>
              <TableHead className="hidden lg:table-cell">Napomena</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {member.entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm">{fmtDateTime(entry.enteredAt, tz)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{methodLabel[entry.method] ?? entry.method}</Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {entry.membership?.plan.name ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{entry.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
            {member.entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nema zabeleženih ulazaka.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
