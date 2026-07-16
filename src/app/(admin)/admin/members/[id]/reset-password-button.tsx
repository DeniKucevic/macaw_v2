"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Lock } from "lucide-react";

interface Props {
  memberId: string;
  memberName: string;
}

export function ResetPasswordButton({ memberId, memberName }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleReset() {
    setError("");
    if (password.length < 6) {
      setError("Lozinka mora imati najmanje 6 znakova.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/members/${memberId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška pri promeni lozinke.");
      return;
    }

    setDone(true);
    setPassword("");
    setTimeout(() => {
      setOpen(false);
      setDone(false);
    }, 1500);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-4 w-4" /> Lozinka
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Promeni lozinku
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promeni lozinku</DialogTitle>
              <DialogDescription>
                Postavite novu lozinku za člana {memberName}. Član će je koristiti
                za prijavu.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova lozinka</Label>
              <Input
                id="new-password"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Najmanje 6 znakova"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              {done && (
                <p className="text-sm text-green-600">Lozinka je promenjena.</p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleReset} disabled={loading || done}>
                {loading ? "Čuvanje…" : "Sačuvaj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Postavite novu lozinku za prijavu ovog člana ako je zaboravio.
        </p>
      </CardContent>
    </Card>
  );
}
