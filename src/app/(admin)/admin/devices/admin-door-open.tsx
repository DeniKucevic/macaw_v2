"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DoorOpen, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Props {
  deviceId: string;
}

export function AdminDoorOpenButton({ deviceId }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleOpen() {
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/door/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });

    const data = await res.json();

    if (res.ok) {
      setStatus("success");
      setMessage("Poslato!");
    } else {
      setStatus("error");
      setMessage(data.error ?? "Greška");
    }

    setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 4000);
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant={status === "success" ? "default" : status === "error" ? "destructive" : "outline"}
        onClick={handleOpen}
        disabled={status === "loading" || status === "success"}
        className="gap-1.5"
      >
        {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {status === "success" && <CheckCircle className="h-3.5 w-3.5" />}
        {status === "error" && <XCircle className="h-3.5 w-3.5" />}
        {status === "idle" && <DoorOpen className="h-3.5 w-3.5" />}
        {status === "loading" ? "Otvaranje…" : status === "success" ? "Poslato!" : status === "error" ? "Greška" : "Otvori vrata"}
      </Button>
      {message && status === "error" && (
        <span className="text-xs text-destructive">{message}</span>
      )}
    </div>
  );
}
