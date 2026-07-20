import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfDay, endOfDay } from "date-fns";

/**
 * All dates/times are rendered and bucketed in the GYM's timezone — never the
 * server's (Vercel runs UTC) and never the viewer's (a member on holiday must
 * still see gym-local times). Pass the gym's configured `timezone`.
 */
export const DEFAULT_TZ = "Europe/Belgrade";

export const fmtDate = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "dd.MM.yyyy");

export const fmtDateTime = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "dd.MM.yyyy HH:mm");

export const fmtTime = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "HH:mm");

/** Short "dd.MM." — used in compact list cells. */
export const fmtDayMonth = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "dd.MM.");

/** "dd.MM. HH:mm" — compact date+time for log/entry tables. */
export const fmtShortDateTime = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "dd.MM. HH:mm");

/** "dd.MM. HH:mm:ss" — device telemetry needs seconds. */
export const fmtLogTime = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "dd.MM. HH:mm:ss");

/** "MM.yyyy" — month grouping in the member's history. */
export const fmtMonthYear = (d: Date, tz: string = DEFAULT_TZ) =>
  formatInTimeZone(d, tz, "MM.yyyy");

/**
 * Start/end of "today" in the gym's timezone, returned as UTC instants for DB
 * queries — so the daily entry limit rolls over at local midnight, not UTC.
 * Handles DST via date-fns-tz.
 */
export function gymDayRange(now: Date, tz: string = DEFAULT_TZ) {
  const zoned = toZonedTime(now, tz);
  return {
    start: fromZonedTime(startOfDay(zoned), tz),
    end: fromZonedTime(endOfDay(zoned), tz),
  };
}
