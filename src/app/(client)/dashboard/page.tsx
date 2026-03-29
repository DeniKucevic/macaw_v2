import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { MembershipStatus } from "@/generated/prisma/client";
import { Calendar, Dumbbell, Clock, KeyRound } from "lucide-react";

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: {
        where: { status: MembershipStatus.ACTIVE },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      entries: {
        orderBy: { enteredAt: "desc" },
        take: 5,
        include: { membership: { include: { plan: true } } },
      },
    },
  });

  if (!user) redirect("/login");

  const membership = user.memberships[0] ?? null;
  const lastEntry = user.entries[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Zdravo, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground text-sm">Status vaše članarine</p>
      </div>

      {/* Status članarine */}
      {membership ? (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{membership.plan.name}</CardTitle>
              <Badge>Aktivna</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {membership.plan.type === "SESSION_BASED" && (
              <div className="space-y-3">
                <div className="text-center py-4">
                  <p className="text-6xl font-bold text-primary">
                    {(membership.sessionsTotal ?? 0) - (membership.sessionsUsed ?? 0)}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">
                    treninga preostalo od {membership.sessionsTotal}
                  </p>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{
                      width: `${((membership.sessionsTotal ?? 0) - (membership.sessionsUsed ?? 0)) / (membership.sessionsTotal ?? 1) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {membership.plan.type === "TIME_BASED" && membership.expiresAt && (
              <div className="text-center py-4">
                <div className="flex justify-center mb-2">
                  <Calendar className="h-10 w-10 text-primary" />
                </div>
                <p className="text-lg font-semibold">
                  Ističe {format(membership.expiresAt, "dd.MM.yyyy")}
                </p>
                <p className="text-muted-foreground text-sm">
                  {formatDistanceToNow(membership.expiresAt, { addSuffix: true })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Nema aktivne članarine</p>
            <p className="text-muted-foreground text-sm mt-1">
              Kontaktirajte teretanu da dobijete članarinu.
            </p>
          </CardContent>
        </Card>
      )}

      {/* PIN kod */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> PIN kod za vrata
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.pin ? (
            <p className="text-4xl font-mono font-bold tracking-widest">{user.pin}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nemate dodeljen PIN. Kontaktirajte recepciju.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Poslednja poseta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Poslednja poseta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lastEntry ? (
            <div className="text-sm">
              <p className="font-medium">{format(lastEntry.enteredAt, "dd.MM.yyyy")}</p>
              <p className="text-muted-foreground">{format(lastEntry.enteredAt, "HH:mm")} · putem {methodLabel[lastEntry.method] ?? lastEntry.method}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nema zabeleženih poseta.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
