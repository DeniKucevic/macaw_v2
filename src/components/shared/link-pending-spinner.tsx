"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Shows a spinner while the parent <Link> navigation is pending. Must be
// rendered as a descendant of the <Link> whose status it should reflect.
// `pending` flips synchronously on click, so this appears instantly — before
// the destination route's loading.tsx skeleton renders.
export function LinkPendingSpinner({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      className={cn("h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground", className)}
      aria-label="Učitavanje"
    />
  );
}
