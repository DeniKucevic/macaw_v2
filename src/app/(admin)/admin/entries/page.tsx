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
import { format } from "date-fns";

const methodLabel: Record<string, string> = {
  RFID: "RFID",
  PHONE: "Aplikacija",
  MANUAL: "Ručni",
};

export default async function EntriesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const entries = await db.entry.findMany({
    where: { gymId: user.gymId },
    include: {
      user: { select: { id: true, name: true } },
      membership: { include: { plan: true } },
    },
    orderBy: { enteredAt: "desc" },
    take: 100,
  });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEntries = entries.filter((e) => e.enteredAt >= todayStart);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Evidencija ulazaka</h1>
        <p className="text-muted-foreground text-sm">
          {todayEntries.length} ulazaka danas · {entries.length} prikazano ukupno
        </p>
      </div>

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
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm font-mono">
                  {format(entry.enteredAt, "dd.MM, HH:mm")}
                </TableCell>
                <TableCell className="font-medium">{entry.user.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      entry.method === "RFID"
                        ? "default"
                        : entry.method === "PHONE"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {methodLabel[entry.method] ?? entry.method}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {entry.membership?.plan.name ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {entry.notes ?? "—"}
                </TableCell>
              </TableRow>
            ))}
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
