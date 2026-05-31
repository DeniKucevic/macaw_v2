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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  type: string;
  durationDays: number | null;
  sessionCount: number | null;
  price: unknown;
  currency: string;
}

interface Props {
  memberId: string;
  plans: Plan[];
}

export function AssignMembershipDialog({ memberId, plans }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState("");
  const [startsAt, setStartsAt] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const selectedPlan = plans.find((p) => p.id === planId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: memberId, planId, startsAt, notes }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri dodeljivanju članarine");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3 w-3 mr-1" /> Dodeli plan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dodeli članarinu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId} required>
              <SelectTrigger>
                <SelectValue placeholder="Odaberi plan…" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} —{" "}
                    {plan.type === "TIME_BASED"
                      ? `${plan.durationDays} dana`
                      : `${plan.sessionCount} treninga`}
                    {" · "}{String(plan.price)} {plan.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlan && (
            <div className="text-sm text-muted-foreground bg-muted rounded px-3 py-2">
              {selectedPlan.type === "TIME_BASED"
                ? `Vremenski: ističe ${selectedPlan.durationDays} dana od početka`
                : `Po treninzima: ${selectedPlan.sessionCount} treninga uključeno`}
            </div>
          )}
          <div className="space-y-1">
            <Label>Počinje</Label>
            <Input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label>Napomena (opciono)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ref. plaćanja, posebni uslovi…"
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
            <Button type="submit" disabled={loading || !planId}>
              {loading ? "Dodeljivanje…" : "Dodeli članarinu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
