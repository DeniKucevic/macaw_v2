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
import { EntryMethod } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

const fmt = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: "Europe/Belgrade",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
};

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; period?: string; method?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const { q, period = "7d", method = "all" } = await searchParams;
  const search = q?.trim() ?? "";

  const now = new Date();
  const where: Prisma.EntryWhereInput = { gymId: user.gymId };

  if (period === "today") {
    where.enteredAt = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
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

  const entries = await db.entry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      membership: { include: { plan: true } },
    },
    orderBy: { enteredAt: "desc" },
    take: 100,
  });

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEntries = entries.filter((e) => e.enteredAt >= todayStart);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Evidencija ulazaka</h1>
        <p className="text-muted-foreground text-sm">
          {todayEntries.length} ulazaka danas · {entries.length} prikazano
        </p>
      </div>

      <EntriesControls />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum i vreme</TableHead>
              <TableHead>Član</TableHead>
              <TableHead>Metod</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Napomena</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const denied = entry.notes?.startsWith("ODBIJEN:");
              return (
                <TableRow key={entry.id} className={denied ? "bg-red-50 dark:bg-red-950/20" : ""}>
                  <TableCell className="text-sm font-mono">
                    {fmt.format(entry.enteredAt)}
                  </TableCell>
                  <TableCell className="font-medium">{entry.user ? entry.user.name : "Nepoznat"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={denied ? "destructive" : entry.method === "RFID" ? "default" : entry.method === "PHONE" ? "secondary" : "outline"}
                    >
                      {denied ? "Odbijen" : (methodLabel[entry.method] ?? entry.method)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {entry.membership?.plan.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
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
    </div>
  );
}
