import { timeAgo } from "@/lib/time";
import type { DeviceReading } from "@/types/domain";

/** A ring or watch that reported in the last three hours is treated as on. */
export const WORN_WINDOW_MS = 3 * 60 * 60 * 1000;

/** Eleanor's sample Oura ring stays on so the example does not go stale. */
export const EXAMPLE_OURA_ID = "c000979e-2bb5-4840-936e-b02e65e2c6df";

export function devicePresence(label: string, readings: DeviceReading[], now = Date.now(), stayOn = false): { on: boolean; headline: string; detail: string } {
  const newest = readings.reduce<DeviceReading | null>((best, item) => (!best || item.recordedAt > best.recordedAt ? item : best), null);
  if (!newest) {
    return { on: false, headline: `${label} is offline`, detail: "No number has arrived from this device." };
  }
  if (stayOn) {
    return { on: true, headline: `${label} is on`, detail: "This example ring stays on. The latest saved numbers are showing." };
  }
  const age = now - new Date(newest.recordedAt).getTime();
  const when = timeAgo(newest.recordedAt, new Date(now));
  if (age >= -60_000 && age <= WORN_WINDOW_MS) {
    return { on: true, headline: `${label} is on`, detail: `The latest number arrived ${when.toLowerCase()}.` };
  }
  return { on: false, headline: `${label} is offline`, detail: `The last number arrived ${when.toLowerCase()}. Nothing newer has come in.` };
}
