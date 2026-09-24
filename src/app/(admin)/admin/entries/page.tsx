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
import { EntriesControls } from "./entries-controls";
import { fmtShortDateTime, gymDayRange, DEFAULT_TZ } from "@/lib/time";
import { EntryMethod } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;


const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
};

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; method?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const gymTz = await db.gym.findUnique({ where: { id: user.gymId }, select: { timezone: true } });
  const tz = gymTz?.timezone || DEFAULT_TZ;

  const { q, period = "7d", method = "all", page: pageParam } = await searchParams;
  const search = q?.trim() ?? "";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const now = new Date();
  const where: Prisma.EntryWhereInput = { gymId: user.gymId };

  const gymToday = gymDayRange(now, tz);

  if (period === "today") {
    where.enteredAt = { gte: gymToday.start };
  } else if (period === "7d") {
    where.enteredAt = { gte: new Date(now.getTime() - 7 * 86400000) };
  } else if (period === "30d") {
    where.enteredAt = { gte: new Date(now.getTime() - 30 * 86400000) };
  }

  if (method === "denied") {
    where.notes = { startsWith: "ODBIJEN:" };
  } else if (method !== "all") {
    where.method = method as EntryMethod;
  }

  if (search) {
    where.user = { name: { contains: search, mode: "insensitive" } };
  }

  // Count the full filtered set so the period/method filters have a VISIBLE
  // effect (the table itself is paginated, which is why a flat take:100 used to
  // make every period look identical).
  const [totalCount, todayCount, entries] = await Promise.all([
    db.entry.count({ where }),
    db.entry.count({
      where: { gymId: user.gymId, enteredAt: { gte: gymToday.start } },
    }),
    db.entry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        membership: { include: { plan: true } },
      },
      orderBy: { enteredAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    sp.set("period", period);
    sp.set("method", method);
    sp.set("page", String(p));
    return `/admin/entries?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Evidencija ulazaka</h1>
        <p className="text-muted-foreground text-sm">
          {todayCount} ulazaka danas · {totalCount} u izabranom periodu
        </p>
      </div>

      <EntriesControls />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum i vreme</TableHead>
              <TableHead>Član</TableHead>
              <TableHead className="hidden sm:table-cell">Metod</TableHead>
              <TableHead className="hidden md:table-cell">Plan</TableHead>
              <TableHead className="hidden lg:table-cell">Napomena</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const denied = entry.notes?.startsWith("ODBIJEN:");
              return (
                <TableRow key={entry.id} className={denied ? "bg-red-50 dark:bg-red-950/20" : ""}>
                  <TableCell className="text-sm font-mono">
                    {fmtShortDateTime(entry.enteredAt, tz)}
                  </TableCell>
                  <TableCell className="font-medium">{entry.user ? entry.user.name : "Nepoznat"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant={denied ? "destructive" : entry.method === "RFID" ? "default" : entry.method === "PHONE" ? "secondary" : "outline"}
                    >
                      {denied ? "Odbijen" : (methodLabel[entry.method] ?? entry.method)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {entry.membership?.plan.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {denied ? entry.notes!.replace("ODBIJEN: ", "") : (entry.notes ?? "—")}
                  </TableCell>
                </TableRow>
              );
            })}
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Nema zabeleženih ulazaka.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Stranica {page} od {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page - 1)}>Prethodna</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Prethodna
              </Button>
            )}
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(page + 1)}>Sledeća</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Sledeća
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
