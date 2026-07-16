"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

const SORTS = [
  { value: "newest", label: "Najnoviji" },
  { value: "oldest", label: "Najstariji" },
  { value: "name", label: "Ime (A–Ž)" },
  { value: "expiry", label: "Ističe najpre" },
];

export function MembersControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const sort = params.get("sort") ?? "newest";

  function apply(next: { q?: string; sort?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.q !== undefined) {
      next.q ? sp.set("q", next.q) : sp.delete("q");
    }
    if (next.sort !== undefined) sp.set("sort", next.sort);
    router.push(`/admin/members?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex-1 min-w-[200px]"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pretraži po imenu, emailu ili telefonu…"
          className="max-w-sm"
        />
      </form>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        Sortiraj:
        <select
          value={sort}
          onChange={(e) => apply({ sort: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
