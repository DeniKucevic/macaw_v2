"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

interface Member {
  membershipId: string;
  userId: string;
  userName: string;
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  expiresAt: string | null;
  sessionsTotal: number | null;
  sessionsUsed: number | null;
  isCurrentlyActive: boolean;
}

const statusLabel: Record<string, string> = {
  ACTIVE: "Aktivna",
  EXPIRED: "Istekla",
  SUSPENDED: "Suspendovana",
  CANCELLED: "Otkazana",
};

interface Props {
  planId: string;
  planName: string;
  activeCount: number;
  totalCount: number;
  /** "count" renders the active-member number; "icon" renders a trash button. */
  trigger: "count" | "icon";
  /** Show the delete/deactivate action (owner-only actions cell). */
  showActions?: boolean;
}

export function PlanMembersDialog({
  planId,
  planName,
  activeCount,
  totalCount,
  trigger,
  showActions = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && members === null) {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/plans/${planId}/members`);
      setLoading(false);
      if (!res.ok) {
        setError("Greška pri učitavanju članova.");
        return;
      }
      const data = await res.json();
      setMembers(data.members);
    }
  }

  async function handleDelete() {
    // With history the API deactivates (keeps records); with none it hard-deletes.
    const willDeactivate = totalCount > 0;
    const msg = willDeactivate
      ? `Plan „${planName}" se koristi u ${totalCount} članarina (uklj. istoriju), pa se ne može trajno obrisati. Biće deaktiviran — sakriven iz novih dodela, istorija ostaje. Nastavi?`
      : `Trajno obrisati plan „${planName}"?`;
    if (!confirm(msg)) return;

    setDeleting(true);
    const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      setError("Greška pri brisanju plana.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger === "count" ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="tabular-nums underline-offset-2 hover:underline hover:text-brand transition-colors"
          title="Prikaži članove na ovom planu"
        >
          {activeCount}
          {totalCount > activeCount && (
            <span className="text-muted-foreground"> ({totalCount})</span>
          )}
        </button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(true)} title="Članovi / obriši plan">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Članarine na planu „{planName}"</DialogTitle>
          <DialogDescription>
            {activeCount} {activeCount === 1 ? "aktivna" : "aktivnih"}
            {totalCount > activeCount
              ? ` · ${totalCount} ukupno (uklj. istoriju)`
              : ""}
            . Isti član može imati više članarina.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto -mx-1 px-1">
          {loading && <p className="text-sm text-muted-foreground py-4">Učitavanje…</p>}
          {error && <p className="text-sm text-destructive py-2">{error}</p>}
          {members && members.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Nijedan član nema ovu članarinu. Plan se može trajno obrisati.
            </p>
          )}
          {members && members.length > 0 && (
            <ul className="divide-y">
              {members.map((m) => (
                <li key={m.membershipId} className="flex items-center justify-between gap-2 py-2">
                  <Link
                    href={`/admin/members/${m.userId}`}
                    className="font-medium hover:text-brand transition-colors truncate"
                  >
                    {m.userName}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 text-sm text-muted-foreground">
                    {m.sessionsTotal != null && (
                      <span>{(m.sessionsTotal ?? 0) - (m.sessionsUsed ?? 0)} tr.</span>
                    )}
                    <Badge variant={m.isCurrentlyActive ? "default" : "secondary"}>
                      {statusLabel[m.status] ?? m.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showActions && (
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "…" : totalCount > 0 ? "Deaktiviraj plan" : "Obriši plan"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
