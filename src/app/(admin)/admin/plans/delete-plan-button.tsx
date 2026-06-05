"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeletePlanButton({ planId, membershipCount }: { planId: string; membershipCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const msg = membershipCount > 0
      ? `Ovaj plan ima ${membershipCount} članarina. Ne može se obrisati — biće deaktiviran. Nastavi?`
      : "Obrisati ovaj plan?";
    if (!confirm(msg)) return;

    setLoading(true);
    await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={loading}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
