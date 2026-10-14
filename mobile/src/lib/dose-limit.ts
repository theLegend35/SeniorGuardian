import { formatTime } from "./format";

type ScheduledMedication = { name: string; instructions: string; frequency: string; times: string[] };

const LIMITS: Array<[RegExp, number]> = [
  [/\bfour times\b|\bq\.?i\.?d\.?\b|\bevery 6 hours\b|\bq6h\b/i, 4],
  [/\bthree times\b|\bt\.?i\.?d\.?\b|\bevery 8 hours\b|\bq8h\b/i, 3],
  [/\btwice\b|\btwo times\b|\bb\.?i\.?d\.?\b|\bevery 12 hours\b|\bq12h\b/i, 2],
  [/\bonce\b|\bone time\b|\bdaily\b|\bevery (morning|evening|night|day)\b|\bat bedtime\b|\bq\.?d\.?\b|\bq\.?h\.?s\.?\b/i, 1],
];

/** How many doses a day the label allows, or null when the wording doesn't say. Mirrors web/lib/medications/schedule.ts. */
export function dailyDoseLimit(text: string): number | null {
  if (/\bas needed\b|\bp\.?r\.?n\.?\b/i.test(text)) return null;
  for (const [pattern, limit] of LIMITS) if (pattern.test(text)) return limit;
  return null;
}

/** Why a new reminder time must not be added, or null if it is safe to offer. */
export function reminderBlockReason(med: ScheduledMedication, time: string): string | null {
  if (med.times.includes(time)) return `There is already a reminder at ${formatTime(time)} for ${med.name}.`;
  const limit = dailyDoseLimit(`${med.instructions} ${med.frequency}`);
  if (limit === null || med.times.length < limit) return null;
  const current = med.times.map(formatTime).join(" and ");
  return `The label for ${med.name} says “${med.instructions.trim().replace(/\.$/, "")}”, and there ${med.times.length === 1 ? "is already a reminder" : `are already ${med.times.length} reminders`} at ${current}. Another reminder could lead to an extra dose, so none was added. If a different time works better, move the existing reminder instead of adding one, and check with a pharmacist first if the label names a time of day.`;
}
