"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

const DAYS = [
  { key: "mon", label: "Ponedeljak" },
  { key: "tue", label: "Utorak" },
  { key: "wed", label: "Sreda" },
  { key: "thu", label: "Četvrtak" },
  { key: "fri", label: "Petak" },
  { key: "sat", label: "Subota" },
  { key: "sun", label: "Nedelja" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

type DayConfig = { isOpen: boolean; open: string; close: string };
type HoursConfig = Record<DayKey, DayConfig>;

const DEFAULT_HOURS: HoursConfig = {
  mon: { isOpen: true, open: "07:00", close: "22:00" },
  tue: { isOpen: true, open: "07:00", close: "22:00" },
  wed: { isOpen: true, open: "07:00", close: "22:00" },
  thu: { isOpen: true, open: "07:00", close: "22:00" },
  fri: { isOpen: true, open: "07:00", close: "21:00" },
  sat: { isOpen: true, open: "08:00", close: "18:00" },
  sun: { isOpen: false, open: "08:00", close: "14:00" },
};

interface Props {
  initialHours: unknown;
  initialTimezone: string;
  isOwner: boolean;
}

export function HoursForm({ initialHours, initialTimezone, isOwner }: Props) {
  const router = useRouter();
  const [hours, setHours] = useState<HoursConfig>(
    (initialHours as HoursConfig) ?? DEFAULT_HOURS
  );
  const [timezone, setTimezone] = useState(initialTimezone);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function updateDay(key: DayKey, field: keyof DayConfig, value: boolean | string) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/gym/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours, timezone }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Greška pri čuvanju podešavanja");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Radno vreme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4">
              <Switch
                checked={hours[key].isOpen}
                onCheckedChange={(v) => updateDay(key, "isOpen", v)}
                disabled={!isOwner}
              />
              <span className="w-28 text-sm font-medium">{label}</span>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={hours[key].open}
                  onChange={(e) => updateDay(key, "open", e.target.value)}
                  disabled={!hours[key].isOpen || !isOwner}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <Input
                  type="time"
                  value={hours[key].close}
                  onChange={(e) => updateDay(key, "close", e.target.value)}
                  disabled={!hours[key].isOpen || !isOwner}
                  className="w-28"
                />
                {!hours[key].isOpen && (
                  <span className="text-xs text-muted-foreground">Zatvoreno</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vremenska zona</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-w-xs">
            <Label>Zona (IANA format)</Label>
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Europe/Belgrade"
              disabled={!isOwner}
            />
            <p className="text-xs text-muted-foreground">
              Primer: Europe/Belgrade, Europe/London, America/New_York
            </p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isOwner && (
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Čuvanje…" : saved ? "Sačuvano!" : "Sačuvaj podešavanja"}
          </Button>
        </div>
      )}

      {!isOwner && (
        <p className="text-sm text-muted-foreground">
          Samo vlasnik može menjati podešavanja.
        </p>
      )}
    </form>
  );
}
