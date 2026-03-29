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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export function AddPlanDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "TIME_BASED",
    durationDays: "30",
    sessionCount: "10",
    price: "",
    currency: "EUR",
    maxPerDay: "1",
  });

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      price: parseFloat(form.price),
      currency: form.currency,
      maxPerDay: parseInt(form.maxPerDay),
      ...(form.type === "TIME_BASED"
        ? { durationDays: parseInt(form.durationDays) }
        : { sessionCount: parseInt(form.sessionCount) }),
    };

    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri kreiranju plana");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" /> Dodaj plan</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novi plan članarine</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Naziv plana</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Mesečni, 10 treninga, itd." required />
          </div>
          <div className="space-y-1">
            <Label>Opis (opciono)</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tip</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIME_BASED">Vremenski</SelectItem>
                  <SelectItem value="SESSION_BASED">Po treninzima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              {form.type === "TIME_BASED" ? (
                <>
                  <Label>Trajanje (dani)</Label>
                  <Input type="number" min="1" value={form.durationDays} onChange={(e) => set("durationDays", e.target.value)} required />
                </>
              ) : (
                <>
                  <Label>Broj treninga</Label>
                  <Input type="number" min="1" value={form.sessionCount} onChange={(e) => set("sessionCount", e.target.value)} required />
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Cena</Label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <Label>Valuta</Label>
              <Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Maks. ulazaka dnevno</Label>
            <Input type="number" min="1" value={form.maxPerDay} onChange={(e) => set("maxPerDay", e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button type="submit" disabled={loading}>{loading ? "Kreiranje…" : "Kreiraj plan"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
