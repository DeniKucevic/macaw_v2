"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface Props {
  memberId: string;
  memberName: string;
  /** Counts shown in the confirm so the owner sees what they're removing. */
  entryCount: number;
  membershipCount: number;
  cardCount: number;
}

export function DeleteMemberButton({
  memberId,
  memberName,
  entryCount,
  membershipCount,
  cardCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška pri brisanju člana.");
      return;
    }

    setOpen(false);
    router.push("/admin/members");
    router.refresh();
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" /> Opasna zona
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Obriši člana
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Obriši člana {memberName}?</DialogTitle>
              <DialogDescription>
                Ovo je trajno i ne može se poništiti.
              </DialogDescription>
            </DialogHeader>
            <div className="text-sm space-y-2">
              <p>Trajno se briše:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>nalog za prijavu i lozinka</li>
                <li>{membershipCount} članarina</li>
                <li>{entryCount} zabeleženih ulazaka</li>
                <li>{cardCount} RFID kartica</li>
              </ul>
              <p className="text-muted-foreground">
                Ako želite samo da sprečite ulazak, obrišite mu karticu ili
                postavite članarinu na „Otkazan" umesto brisanja.
              </p>
              {error && <p className="text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Otkaži
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                {loading ? "Brisanje…" : "Obriši trajno"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Briše člana i svu njegovu istoriju. Radnja je nepovratna.
        </p>
      </CardContent>
    </Card>
  );
}
