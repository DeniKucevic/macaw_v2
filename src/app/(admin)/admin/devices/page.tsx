import Link from "next/link";
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
import { AddDeviceDialog } from "./add-device-dialog";
import { AdminDoorOpenButton } from "./admin-door-open";
import { formatDistanceToNow } from "date-fns";
import { fmtLogTime, DEFAULT_TZ } from "@/lib/time";

export default async function DevicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const devices = await db.device.findMany({
    where: { gymId: user.gymId },
    orderBy: { createdAt: "desc" },
  });

  const gymTz = await db.gym.findUnique({ where: { id: user.gymId }, select: { timezone: true } });
  const tz = gymTz?.timezone || DEFAULT_TZ;

  const logs = await db.deviceLog.findMany({
    where: { gymId: user.gymId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { device: { select: { name: true } } },
  });

  // Map card UID -> member, so a SCAN log shows WHO tapped, not just a hex id.
  const tags = await db.rfidTag.findMany({
    where: { user: { gymId: user.gymId } },
    select: { tagId: true, userId: true, user: { select: { name: true } } },
  });
  const tagOwner = new Map(
    tags.map((t) => [t.tagId.toUpperCase(), { id: t.userId, name: t.user.name }])
  );

  const levelVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    ERROR: "destructive",
    SCAN: "secondary",
    INFO: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Uređaji</h1>
          <p className="text-muted-foreground text-sm">ESP32 čitači i kontroleri vrata</p>
        </div>
        <AddDeviceDialog />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naziv</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Poslednji kontakt</TableHead>
              <TableHead className="hidden lg:table-cell">Tajni ključ</TableHead>
              <TableHead className="text-right">Otvori</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>
                  <Badge variant={device.isOnline ? "default" : "secondary"}>
                    {device.isOnline ? "Online" : "Offline"}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {device.lastSeenAt
                    ? formatDistanceToNow(device.lastSeenAt, { addSuffix: true })
                    : "Nikad"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                    {device.secret}
                  </code>
                </TableCell>
                <TableCell className="text-right">
                  <AdminDoorOpenButton deviceId={device.id} />
                </TableCell>
              </TableRow>
            ))}
            {devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Nema registrovanih uređaja. Dodajte ESP32 čitač vrata.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dnevnik uređaja (telemetrija sa ESP32) */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Dnevnik uređaja</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Vreme</TableHead>
                <TableHead className="hidden sm:table-cell">Uređaj</TableHead>
                <TableHead>Nivo</TableHead>
                <TableHead>Poruka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const owner = log.tagId ? tagOwner.get(log.tagId.toUpperCase()) : undefined;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {fmtLogTime(log.createdAt, tz)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{log.device.name}</TableCell>
                    <TableCell>
                      <Badge variant={levelVariant[log.level] ?? "outline"}>{log.level}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.message}
                      {log.tagId && (
                        owner ? (
                          <>
                            {" — "}
                            <Link
                              href={`/admin/members/${owner.id}`}
                              className="font-medium text-foreground hover:text-brand transition-colors"
                            >
                              {owner.name}
                            </Link>
                          </>
                        ) : (
                          <span className="text-muted-foreground"> — nepoznata kartica</span>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    Još nema telemetrije. Uređaj šalje logove na /api/device/[deviceId]/log.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="text-sm text-muted-foreground bg-muted rounded-lg p-4 space-y-2">
        <p className="font-medium">Vodič za integraciju ESP32</p>
        <p>Uređaj poluje na <code className="bg-background px-1 rounded">POST /api/device/[deviceId]/poll</code> za komande otvaranja (kratki poll, odgovara odmah).</p>
        <p>Za RFID skeniranja, POST na <code className="bg-background px-1 rounded">/api/device/[deviceId]/rfid</code> sa <code className="bg-background px-1 rounded">{"{ tagId, secret }"}</code>.</p>
        <p>Telemetrija/dijagnostika: POST na <code className="bg-background px-1 rounded">/api/device/[deviceId]/log</code> sa <code className="bg-background px-1 rounded">{"{ secret, level, message, tagId? }"}</code> (level: INFO | ERROR | SCAN). ERROR ide i na Discord.</p>
        <p>Nakon otvaranja vrata, potvrdi na <code className="bg-background px-1 rounded">/api/device/[deviceId]/confirm</code> sa <code className="bg-background px-1 rounded">{"{ commandId, secret }"}</code>.</p>
      </div>
    </div>
  );
}
