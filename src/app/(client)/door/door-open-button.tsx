"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DoorOpen, Loader2, CheckCircle2 } from "lucide-react";

type State = "idle" | "loading" | "success" | "error";

export function DoorOpenButton({
  deviceId,
  deviceName,
}: {
  deviceId: string;
  deviceName: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (state === "success") {
      const t = setTimeout(() => setState("idle"), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  async function handleOpen() {
    setState("loading");
    setErrorMsg("");

    const res = await fetch("/api/door/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });

    if (res.ok) {
      setState("success");
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Greška pri otvaranju vrata");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">{deviceName}</p>
      <Button
        size="lg"
        className="h-24 w-48 text-base flex-col gap-2"
        disabled={state === "loading" || state === "success"}
        onClick={handleOpen}
        variant={state === "success" ? "outline" : "default"}
      >
        {state === "loading" && <Loader2 className="h-6 w-6 animate-spin" />}
        {state === "success" && <CheckCircle2 className="h-6 w-6 text-green-500" />}
        {(state === "idle" || state === "error") && <DoorOpen className="h-6 w-6" />}
        <span>
          {state === "loading" && "Slanje…"}
          {state === "success" && "Zahtev poslat!"}
          {state === "idle" && "Otvori vrata"}
          {state === "error" && "Otvori vrata"}
        </span>
      </Button>
      {state === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}
