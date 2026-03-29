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

export default async function DevicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const devices = await db.device.findMany({
    where: { gymId: user.gymId },
    orderBy: { createdAt: "desc" },
  });

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
              <TableHead>Poslednji kontakt</TableHead>
              <TableHead>Tajni ključ</TableHead>
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
                <TableCell className="text-muted-foreground text-sm">
                  {device.lastSeenAt
                    ? formatDistanceToNow(device.lastSeenAt, { addSuffix: true })
                    : "Nikad"}
                </TableCell>
                <TableCell>
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

      <div className="text-sm text-muted-foreground bg-muted rounded-lg p-4 space-y-2">
        <p className="font-medium">Vodič za integraciju ESP32</p>
        <p>Uređaj se pretplaćuje na MQTT temu <code className="bg-background px-1 rounded">macaw/device/[deviceId]/open</code> za komande otvaranja vrata u realnom vremenu.</p>
        <p>Za RFID skeniranja, POST na <code className="bg-background px-1 rounded">/api/device/[deviceId]/rfid</code> sa <code className="bg-background px-1 rounded">{"{ tagId, secret }"}</code>.</p>
      </div>
    </div>
  );
}
