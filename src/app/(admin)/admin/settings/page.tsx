import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { HoursForm } from "./hours-form";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const gym = await db.gym.findUnique({
    where: { id: user.gymId },
    select: { hours: true, timezone: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Podešavanja</h1>
        <p className="text-muted-foreground text-sm">Radno vreme i zona teretane</p>
      </div>

      <HoursForm
        initialHours={gym?.hours ?? null}
        initialTimezone={gym?.timezone ?? "UTC"}
        isOwner={user.role === "OWNER"}
      />
    </div>
  );
}
