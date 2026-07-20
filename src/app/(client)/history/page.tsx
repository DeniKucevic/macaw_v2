import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtTime, fmtMonthYear, DEFAULT_TZ } from "@/lib/time";

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "App",
  MANUAL: "Ručni",
};

export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const gym = await db.gym.findUnique({
    where: { id: user.gymId },
    select: { timezone: true },
  });
  const tz = gym?.timezone || DEFAULT_TZ;

  const entries = await db.entry.findMany({
    where: { userId: user.id, gymId: user.gymId },
    include: { membership: { include: { plan: true } } },
    orderBy: { enteredAt: "desc" },
    take: 100,
  });

  // Grupišemo po mesecu
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const key = fmtMonthYear(entry.enteredAt, tz);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Istorija treninga</h1>
        <p className="text-muted-foreground text-sm">{entries.length} treninga ukupno</p>
      </div>

      {entries.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nema zabeleženih treninga.</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([month, monthEntries]) => (
          <div key={month} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{month}</h2>
              <span className="text-xs text-muted-foreground">{monthEntries.length} treninga</span>
            </div>
            <Card>
              <div className="divide-y">
                {monthEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-medium text-sm">{fmtDate(entry.enteredAt, tz)}</p>
                      <p className="text-xs text-muted-foreground">{fmtTime(entry.enteredAt, tz)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{entry.membership?.plan.name ?? "—"}</span>
                      <Badge variant="outline" className="text-xs">{methodLabel[entry.method] ?? entry.method}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
