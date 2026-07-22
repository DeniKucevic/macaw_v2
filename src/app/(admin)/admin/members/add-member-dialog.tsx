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
  const [form, setForm] = useState({ name: "", identifier: "", phone: "", role: "MEMBER", password: "" });
  const [createdPin, setCreatedPin] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  // Set when the server finds an existing member with the same name; the user
  // must confirm before we re-submit with force:true.
  const [dupNames, setDupNames] = useState<
    { id: string; name: string; phone: string | null; email: string | null; displayUsername: string | null }[] | null
  >(null);

  async function suggestUsername() {
    if (!form.name.trim()) {
      setError("Prvo unesite ime da bismo predložili korisničko ime");
      return;
    }
    setError("");
    setSuggesting(true);
    const res = await fetch(`/api/members/suggest-username?name=${encodeURIComponent(form.name)}`);
    setSuggesting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Neuspešan predlog korisničkog imena");
      return;
    }
    const data = await res.json();
    setForm((f) => ({ ...f, identifier: data.username }));
  }

  async function submit(force: boolean) {
    setError("");
    setLoading(true);

    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, force }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      if (data.code === "DUPLICATE_NAME") {
        setDupNames(data.existing ?? []);
        return;
      }
      setError(data.error ?? "Greška pri dodavanju člana");
      return;
    }

    const data = await res.json();
    setOpen(false);
    setDupNames(null);
    setForm({ name: "", identifier: "", phone: "", role: "MEMBER", password: "" });
    router.refresh();

    if (data.pin) {
      setCreatedPin(data.pin);
    }
  }

  function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    submit(false);
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
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setDupNames(null);
                }}
                placeholder="Marko Marković"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Email ili korisničko ime</Label>
              <div className="flex gap-2">
                <Input
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="marko@primer.com ili markoma"
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={suggestUsername}
                  disabled={suggesting}
                  title="Predloži korisničko ime iz imena"
                >
                  {suggesting ? "…" : "Predloži"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Član se prijavljuje ovim. Ako nema email, koristite korisničko ime.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Lozinka</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="npr. 12345 — član kasnije menja"
                minLength={4}
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
            {dupNames && (
              <div className="rounded-md border border-orange-400/60 bg-orange-50 dark:bg-orange-950/30 p-3 text-sm space-y-2">
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  Već postoji član sa istim imenom:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {dupNames.map((d) => (
                    <li key={d.id}>
                      {d.name}
                      {d.phone ? ` · ${d.phone}` : ""}
                      {d.email ? ` · ${d.email}` : d.displayUsername ? ` · ${d.displayUsername}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground">
                  Proverite da nije ista osoba. Ako je zaista novi član, potvrdite.
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Otkaži
              </Button>
              {dupNames ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading}
                  onClick={() => submit(true)}
                >
                  {loading ? "Kreiranje…" : "Svejedno dodaj"}
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading ? "Kreiranje…" : "Dodaj člana"}
                </Button>
              )}
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
