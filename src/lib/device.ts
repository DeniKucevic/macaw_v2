// A device is considered online if it has polled recently. Computing this from
// `lastSeenAt` at render time (instead of trusting the stored `isOnline` flag)
// means the UI is correct immediately after a device goes silent — without
// waiting for the device-check cron, which on Vercel Hobby only runs once a day.
// The stored `isOnline` flag is still used server-side to send exactly one
// offline alert on the online→offline transition.
export const DEVICE_OFFLINE_AFTER_MS = 5 * 60 * 1000; // 5 min, matches the cron

export function isDeviceOnline(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < DEVICE_OFFLINE_AFTER_MS;
}
