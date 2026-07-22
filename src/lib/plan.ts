import { addDays, addMonths } from "date-fns";

// Serbian pluralization (Latin). 1 → mesec, 2–4 → meseca, else → meseci,
// with the -11/-12/-13/-14 exceptions.
function srUnit(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

interface PlanDuration {
  type: string;
  durationDays: number | null;
  durationMonths?: number | null;
  sessionCount: number | null;
}

/** Human label for a plan's duration, e.g. "1 mesec", "3 meseca", "30 dana",
 *  "10 treninga". */
export function planDurationLabel(plan: PlanDuration): string {
  if (plan.type === "SESSION_BASED") {
    return `${plan.sessionCount} ${srUnit(plan.sessionCount ?? 0, "trening", "treninga", "treninga")}`;
  }
  if (plan.durationMonths) {
    return `${plan.durationMonths} ${srUnit(plan.durationMonths, "mesec", "meseca", "meseci")}`;
  }
  if (plan.durationDays) {
    return `${plan.durationDays} ${srUnit(plan.durationDays, "dan", "dana", "dana")}`;
  }
  return "—";
}

/** Expiry for a time-based membership. Months use calendar math (addMonths
 *  clamps end-of-month, so 31 Jan + 1mo = 28/29 Feb). Session-based → null. */
export function membershipExpiry(
  startsAt: Date,
  plan: { type: string; durationDays: number | null; durationMonths: number | null }
): Date | null {
  if (plan.type !== "TIME_BASED") return null;
  if (plan.durationMonths) return addMonths(startsAt, plan.durationMonths);
  if (plan.durationDays) return addDays(startsAt, plan.durationDays);
  return null;
}
