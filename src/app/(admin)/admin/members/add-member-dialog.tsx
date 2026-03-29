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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export function AddMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "MEMBER", password: "" });
  const [createdPin, setCreatedPin] = useState<string | null>(null);

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri dodavanju člana");
      return;
    }

    const data = await res.json();
    setOpen(false);
    setForm({ name: "", email: "", phone: "", role: "MEMBER", password: "" });
    router.refresh();

    if (data.pin) {
      setCreatedPin(data.pin);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-1" /> Dodaj člana
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj novog člana</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Ime</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Marko Marković"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="marko@primer.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Lozinka</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimalno 6 karaktera"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Telefon (opciono)</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+381 60 000 0000"
              />
            </div>
            <div className="space-y-1">
              <Label>Uloga</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Član</SelectItem>
                  <SelectItem value="STAFF">Osoblje</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Otkaži
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Kreiranje…" : "Dodaj člana"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PIN display dialog */}
      <Dialog open={!!createdPin} onOpenChange={() => setCreatedPin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Član kreiran</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            PIN kod člana za ulaz na vrata. Uvek ga možete videti na stranici člana.
          </p>
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-4xl font-mono font-bold tracking-widest">{createdPin}</p>
          </div>
          <Button onClick={() => setCreatedPin(null)}>Gotovo</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
