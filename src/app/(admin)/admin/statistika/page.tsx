import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DEFAULT_TZ, gymDayRange } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

const PERIODS = [
  { value: "today", label: "Danas" },
  { value: "7d", label: "7 dana" },
  { value: "30d", label: "30 dana" },
  { value: "all", label: "Sve vreme" },
];

const WEEKDAYS = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
  PIN: "PIN",
};

// Heat intensity → a fixed set of classes so Tailwind can see them at build time.
function heatClass(count: number, max: number): string {
  if (count === 0) return "bg-muted/40";
  const r = count / max;
  if (r > 0.8) return "bg-brand";
  if (r > 0.6) return "bg-brand/80";
  if (r > 0.4) return "bg-brand/60";
  if (r > 0.2) return "bg-brand/40";
  return "bg-brand/20";
}

export default async function StatistikaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const gym = await db.gym.findUnique({
    where: { id: user.gymId },
    select: { timezone: true },
  });
  const tz = gym?.timezone || DEFAULT_TZ;

  const { period = "30d" } = await searchParams;
  const now = new Date();

  const where: Prisma.EntryWhereInput = { gymId: user.gymId };
  let periodDays = 30;
  if (period === "today") {
    where.enteredAt = { gte: gymDayRange(now, tz).start };
    periodDays = 1;
  } else if (period === "7d") {
    where.enteredAt = { gte: new Date(now.getTime() - 7 * 86400000) };
    periodDays = 7;
  } else if (period === "30d") {
    where.enteredAt = { gte: new Date(now.getTime() - 30 * 86400000) };
    periodDays = 30;
  }

  const rows = await db.entry.findMany({
    where,
    select: { enteredAt: true, method: true },
  });

  // Bucket everything in the gym's timezone.
  const byHour = new Array(24).fill(0) as number[];
  const byWeekday = new Array(7).fill(0) as number[];
  const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const byMethod: Record<string, number> = {};
  let earliest = now;

  for (const r of rows) {
    const hour = parseInt(formatInTimeZone(r.enteredAt, tz, "H"), 10);
    const wd = parseInt(formatInTimeZone(r.enteredAt, tz, "i"), 10) - 1; // Mon=0..Sun=6
    byHour[hour]++;
    byWeekday[wd]++;
    heat[wd][hour]++;
    byMethod[r.method] = (byMethod[r.method] ?? 0) + 1;
    if (r.enteredAt < earliest) earliest = r.enteredAt;
  }

  const total = rows.length;
  const days =
    period === "all" && total
      ? Math.max(1, Math.ceil((now.getTime() - earliest.getTime()) / 86400000))
      : periodDays;
  const avgPerDay = total ? total / days : 0;

  const maxHour = Math.max(1, ...byHour);
  const maxWeekday = Math.max(1, ...byWeekday);
  const maxHeat = Math.max(1, ...heat.flat());

  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakWeekday = byWeekday.indexOf(Math.max(...byWeekday));

  const methods = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);

  const tiles = [
    { label: "Ukupno ulazaka", value: total.toLocaleString("sr-Latn") },
    { label: "Prosečno dnevno", value: avgPerDay.toFixed(1) },
    { label: "Najprometniji sat", value: total ? `${peakHour}:00` : "—" },
    { label: "Najprometniji dan", value: total ? WEEKDAYS[peakWeekday] : "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Statistika</h1>
          <p className="text-muted-foreground text-sm">
            Ulasci članova, načini i vreme aktivnosti
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-input p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/statistika?period=${p.value}`}
              className={cn(
                "rounded px-3 py-1 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <div className="text-muted-foreground text-xs">{t.label}</div>
            <div className="mt-1 text-2xl font-bold">{t.value}</div>
          </Card>
        ))}
      </div>

      {total === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Nema ulazaka u izabranom periodu.
        </Card>
      ) : (
        <>
          {/* Method breakdown */}
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Način ulaska</h2>
            <div className="space-y-3">
              {methods.map(([m, count]) => {
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={m}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{methodLabel[m] ?? m}</span>
                      <span className="text-muted-foreground">
                        {count.toLocaleString("sr-Latn")} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Entries by hour */}
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Ulasci po satu</h2>
            <div className="flex h-40 items-end gap-[3px]">
              {byHour.map((count, h) => (
                <div
                  key={h}
                  className="flex-1 rounded-t bg-brand/80 transition-colors hover:bg-brand"
                  style={{ height: `${Math.max(2, (count / maxHour) * 100)}%` }}
                  title={`${h}:00 — ${count} ulazaka`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              {[0, 6, 12, 18, 23].map((h) => (
                <span key={h}>{h}:00</span>
              ))}
            </div>
          </Card>

          {/* Entries by weekday */}
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Ulasci po danu u nedelji</h2>
            <div className="flex h-32 items-end gap-2">
              {byWeekday.map((count, wd) => (
                <div key={wd} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-brand/80 hover:bg-brand"
                      style={{ height: `${Math.max(2, (count / maxWeekday) * 100)}%` }}
                      title={`${WEEKDAYS[wd]} — ${count} ulazaka`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{WEEKDAYS[wd]}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Heatmap: weekday × hour */}
          <Card className="p-5">
            <h2 className="mb-1 font-semibold">Mapa aktivnosti</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Kada je najprometnije — dan u nedelji × sat
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[560px] space-y-1">
                {heat.map((rowCounts, wd) => (
                  <div key={wd} className="flex items-center gap-1">
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">
                      {WEEKDAYS[wd]}
                    </span>
                    <div className="flex flex-1 gap-[2px]">
                      {rowCounts.map((count, h) => (
                        <div
                          key={h}
                          className={cn("h-5 flex-1 rounded-sm", heatClass(count, maxHeat))}
                          title={`${WEEKDAYS[wd]} ${h}:00 — ${count} ulazaka`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-1 pt-1">
                  <span className="w-8 shrink-0" />
                  <div className="flex flex-1 justify-between text-[10px] text-muted-foreground">
                    {[0, 6, 12, 18, 23].map((h) => (
                      <span key={h}>{h}h</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
