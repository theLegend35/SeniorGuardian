import { timeAgo } from "@/lib/time";
import type { DeviceReading } from "@/types/domain";

/** A ring or watch that reported in the last three hours is treated as on; older numbers mean it is offline. */
export const WORN_WINDOW_MS = 3 * 60 * 60 * 1000;

export function devicePresence(label: string, readings: DeviceReading[], now = Date.now()): { on: boolean; headline: string; detail: string } {
  const newest = readings.reduce<DeviceReading | null>((best, item) => (!best || item.recordedAt > best.recordedAt ? item : best), null);
  if (!newest) {
    return { on: false, headline: `${label} is offline`, detail: "No number has arrived from this device." };
  }
  const age = now - new Date(newest.recordedAt).getTime();
  const when = timeAgo(newest.recordedAt, new Date(now));
  if (age >= -60_000 && age <= WORN_WINDOW_MS) {
    return { on: true, headline: `${label} is on`, detail: `The latest number arrived ${when.toLowerCase()}.` };
  }
  return { on: false, headline: `${label} is offline`, detail: `The last number arrived ${when.toLowerCase()}. Nothing newer has come in.` };
}
