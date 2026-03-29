"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

export function AddDeviceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ id: string; secret: string; name: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri kreiranju uređaja");
      return;
    }

    const data = await res.json();
    setCreated(data);
  }

  function handleClose() {
    setOpen(false);
    setCreated(null);
    setName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Dodaj uređaj</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registruj novi uređaj</DialogTitle>
        </DialogHeader>
        {created ? (
          <div className="space-y-4 mt-2">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
              <p className="font-medium text-green-800 dark:text-green-200">Uređaj kreiran!</p>
              <p className="text-sm text-muted-foreground">Sačuvajte ovaj tajni ključ — prikazuje se samo jednom.</p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ID uređaja</p>
                <code className="text-xs font-mono bg-background px-2 py-1 rounded block">{created.id}</code>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Tajni ključ</p>
                <code className="text-sm font-mono bg-background px-2 py-1 rounded block break-all">{created.secret}</code>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">Gotovo</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Naziv uređaja</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Glavna vrata, Zadnji ulaz…"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
              <Button type="submit" disabled={loading}>{loading ? "Kreiranje…" : "Kreiraj uređaj"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
