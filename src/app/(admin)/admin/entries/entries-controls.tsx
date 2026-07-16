"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

const PERIODS = [
  { value: "today", label: "Danas" },
  { value: "7d", label: "Poslednjih 7 dana" },
  { value: "30d", label: "Poslednjih 30 dana" },
  { value: "all", label: "Sve" },
];

const METHODS = [
  { value: "all", label: "Svi metodi" },
  { value: "RFID", label: "RFID" },
  { value: "PHONE", label: "Aplikacija" },
  { value: "MANUAL", label: "Ručni" },
  { value: "denied", label: "Odbijeni" },
];

export function EntriesControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const period = params.get("period") ?? "7d";
  const method = params.get("method") ?? "all";

  function apply(next: { q?: string; period?: string; method?: string }) {
    const sp = new URLSearchParams(params.toString());
    if (next.q !== undefined) {
      next.q ? sp.set("q", next.q) : sp.delete("q");
    }
    if (next.period !== undefined) sp.set("period", next.period);
    if (next.method !== undefined) sp.set("method", next.method);
    router.push(`/admin/entries?${sp.toString()}`);
  }

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q });
        }}
        className="flex-1 min-w-[180px]"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pretraži po imenu člana…"
          className="max-w-xs"
        />
      </form>
      <select
        value={period}
        onChange={(e) => apply({ period: e.target.value })}
        className={selectCls}
      >
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        value={method}
        onChange={(e) => apply({ method: e.target.value })}
        className={selectCls}
      >
        {METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
