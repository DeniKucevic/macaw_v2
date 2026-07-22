"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { AtSign } from "lucide-react";

interface Props {
  memberId: string;
  memberName: string;
  /** Current login handle — email or username, or null if somehow unset. */
  currentHandle: string | null;
}

export function EditLoginDialog({ memberId, memberName, currentHandle }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState(currentHandle ?? "");
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState("");

  async function suggestUsername() {
    setError("");
    setSuggesting(true);
    const res = await fetch(`/api/members/suggest-username?name=${encodeURIComponent(memberName)}`);
    setSuggesting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Neuspešan predlog korisničkog imena");
      return;
    }
    const data = await res.json();
    setIdentifier(data.username);
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Greška pri izmeni prijave.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  // Reset the field to the current handle whenever the dialog opens.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setIdentifier(currentHandle ?? "");
      setError("");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AtSign className="h-4 w-4" /> Prijava
        </CardTitle>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Izmeni prijavu
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Izmeni prijavu</DialogTitle>
              <DialogDescription>
                Email ili korisničko ime kojim se {memberName} prijavljuje. Lozinka
                ostaje ista.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="edit-identifier">Email ili korisničko ime</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-identifier"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="marko@primer.com ili markoma"
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
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleSave}
                disabled={loading || !identifier.trim() || identifier.trim() === (currentHandle ?? "")}
              >
                {loading ? "Čuvanje…" : "Sačuvaj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Trenutno: <span className="font-medium text-foreground">{currentHandle ?? "—"}</span>
        </p>
      </CardContent>
    </Card>
  );
}
