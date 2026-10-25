import { appWallTime, formatTime } from "@/lib/time";

/**
 * A dose can be marked taken from an hour before its time. Earlier than that, a tap is more likely a mistake
 * (the evening dose marked in the morning), and a "Taken" mark could make someone skip a dose they still need.
 */
export const MARK_EARLY_MINUTES = 60;

function minus(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = (((hours * 60 + mins - minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Whether the dose at this wall-clock time (YYYY-MM-DDTHH:MM, Central time) can be marked taken now. */
export function canMarkTaken(scheduledFor: string, now = Date.now()): boolean {
  return now >= appWallTime(scheduledFor).getTime() - MARK_EARLY_MINUTES * 60_000;
}

/** The clock time from which a dose at `time` can be marked taken, such as "7:00 PM" for an 8:00 PM dose. */
export function markOpensTime(time: string): string {
  return formatTime(minus(time, MARK_EARLY_MINUTES));
}

/** Why the dose cannot be marked taken yet, or null when it can. */
export function earlyMarkReason(scheduledFor: string, time: string, now = Date.now()): string | null {
  if (canMarkTaken(scheduledFor, now)) return null;
  return `The ${formatTime(time)} dose is not due yet. It can be marked taken from ${markOpensTime(time)}.`;
}
