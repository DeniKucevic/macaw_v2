import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoorOpenButton } from "./door-open-button";

export default async function DoorPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const devices = await db.device.findMany({
    where: { gymId: user.gymId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Otvori vrata</h1>
        <p className="text-muted-foreground text-sm">Pošaljite zahtev za otvaranje vrata.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dostupna vrata</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nema konfigurisanih vrata.</p>
          ) : (
            <div className="flex flex-wrap gap-8 justify-center py-4">
              {devices.map((device) => (
                <DoorOpenButton
                  key={device.id}
                  deviceId={device.id}
                  deviceName={device.name}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
