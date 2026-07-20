import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmtDateTime, DEFAULT_TZ } from "@/lib/time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


const actionLabel: Record<string, string> = {
  MEMBER_CREATED: "Član kreiran",
  MEMBER_UPDATED: "Član izmenjen",
  MEMBER_ROLE_CHANGED: "Uloga promenjena",
  MEMBER_DELETED: "Član obrisan",
  PASSWORD_RESET: "Lozinka resetovana",
  MEMBERSHIP_ASSIGNED: "Članarina dodeljena",
  PLAN_DELETED: "Plan obrisan",
  PLAN_DEACTIVATED: "Plan deaktiviran",
  DEVICE_OFFLINE: "Uređaj van mreže",
  DEVICE_ONLINE: "Uređaj na mreži",
};

const systemActions = new Set(["DEVICE_OFFLINE", "DEVICE_ONLINE"]);

export default async function AuditPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const gymTz = await db.gym.findUnique({ where: { id: user.gymId }, select: { timezone: true } });
  const tz = gymTz?.timezone || DEFAULT_TZ;

  const logs = await db.auditLog.findMany({
    where: { gymId: user.gymId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dnevnik izmena</h1>
        <p className="text-muted-foreground text-sm">
          Poslednjih {logs.length} zabeleženih radnji
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vreme</TableHead>
              <TableHead className="hidden md:table-cell">Ko</TableHead>
              <TableHead>Radnja</TableHead>
              <TableHead className="hidden sm:table-cell">Na čemu</TableHead>
              <TableHead className="hidden lg:table-cell">Detalji</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => {
              const isSystem = systemActions.has(log.action);
              return (
                <TableRow key={log.id}>
                  <TableCell className="text-sm font-mono whitespace-nowrap">
                    {fmtDateTime(log.createdAt, tz)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {log.actorName ?? (isSystem ? "Sistem" : "—")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isSystem ? "outline" : "secondary"}>
                      {actionLabel[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {log.targetLabel ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Još nema zabeleženih radnji.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
