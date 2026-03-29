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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil } from "lucide-react";

interface Membership {
  id: string;
  status: string;
  expiresAt: Date | null;
  sessionsTotal: number | null;
  sessionsUsed: number | null;
  plan: { type: string };
}

export function EditMembershipDialog({ membership }: { membership: Membership }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isTimeBased = membership.plan.type === "TIME_BASED";
  const isSessionBased = membership.plan.type === "SESSION_BASED";

  const [extendDays, setExtendDays] = useState("30");
  const [addSessions, setAddSessions] = useState("10");
  const [status, setStatus] = useState(membership.status);

  async function handleUpdate(payload: Record<string, unknown>) {
    setError("");
    setLoading(true);

    const res = await fetch(`/api/memberships/${membership.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri ažuriranju");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="h-3 w-3 mr-1" /> Izmeni
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Izmeni članarinu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Tabs defaultValue={isTimeBased ? "extend" : "sessions"}>
            <TabsList className="w-full">
              {isTimeBased && <TabsTrigger value="extend" className="flex-1">Produženje</TabsTrigger>}
              {isSessionBased && <TabsTrigger value="sessions" className="flex-1">Dodaj treninge</TabsTrigger>}
              <TabsTrigger value="status" className="flex-1">Status</TabsTrigger>
            </TabsList>

            {isTimeBased && (
              <TabsContent value="extend" className="space-y-3 pt-3">
                <div className="space-y-1">
                  <Label>Produži za (dana)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={extendDays}
                    onChange={(e) => setExtendDays(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => handleUpdate({ extendDays: parseInt(extendDays) })}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Ažuriranje…" : `Produži za ${extendDays} dana`}
                </Button>
              </TabsContent>
            )}

            {isSessionBased && (
              <TabsContent value="sessions" className="space-y-3 pt-3">
                <div className="text-sm text-muted-foreground">
                  Trenutno: {(membership.sessionsTotal ?? 0) - (membership.sessionsUsed ?? 0)} treninga preostalo
                </div>
                <div className="space-y-1">
                  <Label>Dodaj treninge</Label>
                  <Input
                    type="number"
                    min="1"
                    value={addSessions}
                    onChange={(e) => setAddSessions(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => handleUpdate({ addSessions: parseInt(addSessions) })}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Ažuriranje…" : `Dodaj ${addSessions} treninga`}
                </Button>
              </TabsContent>
            )}

            <TabsContent value="status" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Aktivan</SelectItem>
                    <SelectItem value="SUSPENDED">Suspendovan</SelectItem>
                    <SelectItem value="CANCELLED">Otkazan</SelectItem>
                    <SelectItem value="EXPIRED">Istekao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => handleUpdate({ status })}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Ažuriranje…" : "Ažuriraj status"}
              </Button>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
