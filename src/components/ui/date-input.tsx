"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

// Native <input type="date"> renders in the browser's locale (US month-first in
// many setups), which this app can't control. This field displays and accepts
// the Serbian format dd.MM.yyyy while still handing the parent an ISO yyyy-MM-dd
// string, so the API is unchanged.

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : "";
}

function displayToIso(s: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(s.trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const date = new Date(y, mo - 1, d);
  // Reject impossible dates like 31.02.2026 (JS would roll them over).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}`;
}

interface Props {
  /** ISO date, yyyy-MM-dd */
  value: string;
  /** Called with an ISO date, yyyy-MM-dd, once the text is a valid date */
  onChange: (iso: string) => void;
  id?: string;
  required?: boolean;
  className?: string;
}

export function DateInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(() => isoToDisplay(value));

  // Sync when the parent changes the value (e.g. reset after submit).
  useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  return (
    <Input
      {...rest}
      inputMode="numeric"
      placeholder="dd.mm.gggg"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const iso = displayToIso(e.target.value);
        if (iso) onChange(iso);
      }}
    />
  );
}
