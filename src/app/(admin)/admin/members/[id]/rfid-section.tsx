"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2 } from "lucide-react";

interface RfidTag {
  id: string;
  tagId: string;
  label: string | null;
  isActive: boolean;
}

interface Props {
  memberId: string;
  initialTags: RfidTag[];
}

export function RfidSection({ memberId, initialTags }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [tagId, setTagId] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAdd(e: { preventDefault(): void }) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/members/${memberId}/rfid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tagId.trim(), label: label.trim() || undefined }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri dodavanju kartice");
      return;
    }

    setTagId("");
    setLabel("");
    setAdding(false);
    router.refresh();
  }

  async function handleDelete(tag: RfidTag) {
    setDeletingId(tag.id);

    const res = await fetch(`/api/members/${memberId}/rfid/${tag.id}`, {
      method: "DELETE",
    });

    setDeletingId(null);

    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4" /> RFID kartice
        </CardTitle>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Dodaj karticu
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {initialTags.length === 0 && !adding && (
          <p className="text-muted-foreground text-sm">Nema dodeljenih RFID kartica.</p>
        )}

        {initialTags.map((tag) => (
          <div key={tag.id} className="flex items-center justify-between text-sm">
            <span className="font-mono">{tag.tagId}</span>
            <span className="text-muted-foreground flex-1 mx-3">{tag.label ?? "—"}</span>
            <Badge variant={tag.isActive ? "default" : "secondary"} className="mr-2">
              {tag.isActive ? "Aktivna" : "Neaktivna"}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleDelete(tag)}
              disabled={deletingId === tag.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        {adding && (
          <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t">
            <div className="flex gap-2">
              <Input
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                placeholder="ID kartice (npr. A1B2C3D4)"
                required
                autoFocus
                className="font-mono"
              />
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Naziv (opciono)"
                className="max-w-36"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Dodavanje…" : "Dodaj"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setAdding(false); setError(""); setTagId(""); setLabel(""); }}
              >
                Otkaži
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
