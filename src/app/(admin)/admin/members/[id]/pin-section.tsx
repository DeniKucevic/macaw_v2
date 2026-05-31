"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  memberId: string;
  pin: string | null;
}

export function PinSection({ memberId, pin: initialPin }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    setError("");
    setLoading(true);

    const res = await fetch(`/api/members/${memberId}/pin`, { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri generisanju PIN-a");
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> PIN kod
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Generisanje…" : "Resetuj PIN"}
        </Button>
      </CardHeader>
      <CardContent>
        {initialPin ? (
          <p className="text-4xl font-mono font-bold tracking-widest">{initialPin}</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            PIN nije dodeljen. Kliknite "Resetuj PIN" da generišete novi.
          </p>
        )}
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
