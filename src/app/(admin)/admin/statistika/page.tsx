import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DEFAULT_TZ, gymDayRange } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/client";

const PERIODS = [
  { value: "today", label: "Danas" },
  { value: "7d", label: "7 dana" },
  { value: "30d", label: "30 dana" },
  { value: "all", label: "Sve vreme" },
];

// Index Mon=0..Sun=6, matching date-fns ISO weekday ("i") minus 1.
const WEEKDAYS = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
  PIN: "PIN",
};

type DayCfg = { isOpen: boolean; open: string; close: string };

// Heat intensity → a fixed set of classes so Tailwind sees them at build time.
function heatClass(count: number, max: number): string {
  if (count === 0) return "bg-muted/40"; // open but quiet
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
    select: { timezone: true, hours: true },
  });
  const tz = gym?.timezone || DEFAULT_TZ;

  // Working-hours config (null = always open). Build per-weekday open flag and
  // open/close hour so we can separate "closed" from "open but quiet".
  const hoursCfg = gym?.hours as unknown as Record<string, DayCfg> | null;
  const openWeekday: boolean[] = [];
  const openStart: number[] = [];
  const openEnd: number[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const c = hoursCfg?.[DAY_KEYS[wd]];
    if (!hoursCfg) {
      openWeekday[wd] = true;
      openStart[wd] = 0;
      openEnd[wd] = 24;
    } else {
      const isOpen = c?.isOpen ?? false;
      openWeekday[wd] = isOpen;
      openStart[wd] = isOpen ? parseInt((c?.open ?? "00:00").split(":")[0], 10) : 0;
      openEnd[wd] = isOpen ? parseInt((c?.close ?? "24:00").split(":")[0], 10) : 0;
    }
  }
  const isCellOpen = (wd: number, h: number) =>
    openWeekday[wd] && h >= openStart[wd] && h < openEnd[wd];

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

  // Busiest members — real members only (staff/owner bypass checks and would
  // otherwise dominate the list).
  const topRaw = await db.entry.groupBy({
    by: ["userId"],
    where: { ...where, userId: { not: null }, user: { role: Role.MEMBER } },
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 8,
  });
  const topIds = topRaw.map((r) => r.userId).filter((x): x is string => !!x);
  const topUsers = topIds.length
    ? await db.user.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(topUsers.map((u) => [u.id, u.name]));
  const topMembers = topRaw.map((r) => ({
    id: r.userId as string,
    name: nameById.get(r.userId as string) ?? "Nepoznat",
    count: r._count.userId,
  }));

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
  const dayMs = 86400000;

  // Count only OPEN days in the period, so the average reflects working days
  // (e.g. Sundays are closed and shouldn't drag the number down).
  const spanDays =
    period === "all" && total
      ? Math.max(1, Math.ceil((now.getTime() - earliest.getTime()) / dayMs))
      : periodDays;
  let openDaysCount = 0;
  for (let i = 0; i < spanDays; i++) {
    const d = new Date(now.getTime() - i * dayMs);
    const wd = parseInt(formatInTimeZone(d, tz, "i"), 10) - 1;
    if (openWeekday[wd]) openDaysCount++;
  }
  openDaysCount = Math.max(1, openDaysCount);
  const avgPerOpenDay = total ? total / openDaysCount : 0;

  // Entries logged outside working hours — worth surfacing (master-card/manual
  // opens, or someone getting in when the gym is closed).
  let offHours = 0;
  for (let wd = 0; wd < 7; wd++)
    for (let h = 0; h < 24; h++) if (!isCellOpen(wd, h)) offHours += heat[wd][h];

  const maxHour = Math.max(1, ...byHour);
  const maxWeekday = Math.max(1, ...byWeekday);
  const maxHeat = Math.max(1, ...heat.flat());

  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakWeekday = byWeekday.indexOf(Math.max(...byWeekday));

  const methods = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);

  const tiles = [
    { label: "Ukupno ulazaka", value: total.toLocaleString("sr-Latn") },
    { label: "Po radnom danu", value: avgPerOpenDay.toFixed(1) },
    { label: "Najprometniji sat", value: total ? `${peakHour}:00` : "—" },
    { label: "Najprometniji dan", value: total ? WEEKDAYS[peakWeekday] : "—" },
  ];

  function cellClass(wd: number, h: number, count: number): string {
    if (!isCellOpen(wd, h)) return count > 0 ? "bg-amber-400/70" : "bg-muted/20";
    return heatClass(count, maxHeat);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Statistika</h1>
          <p className="text-muted-foreground text-sm">
            Ulasci članova, načini i vreme aktivnosti · prosek po radnom danu
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
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Busiest members */}
          {topMembers.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-4 font-semibold">Najaktivniji članovi</h2>
              <div className="space-y-2">
                {topMembers.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-4 text-right text-sm text-muted-foreground">
                      {i + 1}
                    </span>
                    <Link
                      href={`/admin/members/${m.id}`}
                      className="flex-1 truncate text-sm font-medium hover:text-brand hover:underline"
                    >
                      {m.name}
                    </Link>
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted sm:w-40">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(m.count / topMembers[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-sm text-muted-foreground">
                      {m.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
                  <span
                    className={cn(
                      "text-xs",
                      openWeekday[wd]
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {WEEKDAYS[wd]}
                    {!openWeekday[wd] && " ·"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              · = neradni dan
            </p>
          </Card>

          {/* Heatmap: weekday × hour, schedule-aware */}
          <Card className="p-5">
            <h2 className="mb-1 font-semibold">Mapa aktivnosti</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Kada je najprometnije — dan u nedelji × sat (radno vreme uzeto u obzir)
            </p>
            <div className="overflow-x-auto">
              <div className="min-w-[560px] space-y-1">
                {heat.map((rowCounts, wd) => (
                  <div key={wd} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "w-8 shrink-0 text-xs",
                        openWeekday[wd]
                          ? "text-muted-foreground"
                          : "text-muted-foreground/40"
                      )}
                    >
                      {WEEKDAYS[wd]}
                    </span>
                    <div className="flex flex-1 gap-[2px]">
                      {rowCounts.map((count, h) => (
                        <div
                          key={h}
                          className={cn("h-5 flex-1 rounded-sm", cellClass(wd, h, count))}
                          title={`${WEEKDAYS[wd]} ${h}:00 — ${count} ulazaka${
                            isCellOpen(wd, h) ? "" : " (van radnog vremena)"
                          }`}
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

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-brand" /> Prometno
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-muted/40" /> Otvoreno, mirno
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-muted/20" /> Zatvoreno
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-amber-400/70" /> Van radnog vremena
              </span>
            </div>

            {offHours > 0 && (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-500">
                {offHours} {offHours === 1 ? "ulazak" : "ulazaka"} van radnog vremena u ovom periodu.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
