import { formatTime, localDate } from "@/lib/time";

type ScheduledMedication = { name: string; instructions: string; frequency: string; times: string[] };

/** What decides which days a dose is due: the label wording, and when the medicine starts and ends. */
type DatedMedication = {
  instructions: string;
  frequency: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
};

// The rules below are mirrored in mobile/src/lib/dose-limit.ts. Change both together.

const WORD_COUNTS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const ADVERB_COUNTS: Record<string, number> = { once: 1, twice: 2, thrice: 3 };

// "3 times", "3x", "three times", "once", "twice". A bare number ("take 2 daily") is a dose, not a count.
const TIMES = String.raw`(?:(\d+) ?(?:times?|x)|(one|two|three|four|five|six) times?|(once|twice|thrice))`;
const PER_DAY = new RegExp(String.raw`\b${TIMES} (?:a |per |each |every )?(?:day|daily)\b`);
const PER_WEEK = new RegExp(String.raw`\b${TIMES} (?:a |per |each |every )?week(?:ly)?\b`);
const HOURS = String.raw`(\d+(?:\.\d+)?|one|two|three|four|five|six|eight|ten|twelve)`;
const SMALL = String.raw`(\d+|two|three|four|five|six)`;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY = String.raw`(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?`;
const SHORT_DAYS: Record<string, number> = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };
const SHORT_DAY = String.raw`(?:sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\.?`;
const SHORT_LIST = new RegExp(String.raw`\b${SHORT_DAY}(?: ?(?:/|,|&|and) ?${SHORT_DAY})+(?![a-z])`, "g");

// Wording that means every day, so one weekday or "weekly" elsewhere on the label is about something else.
const DAILY_WORDS = /\bdaily\b|\bevery day\b|\b(?:a|per|each) day\b|\bevery (?:morning|evening|night)\b|\bnightly\b/;

function plain(text: string): string {
  return ` ${text.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ")} `;
}

function numberOf(word: string): number {
  return /^\d/.test(word) ? Number(word) : (WORD_COUNTS[word] ?? Number.NaN);
}

function timesCount(match: RegExpMatchArray): number {
  if (match[1]) return Number(match[1]);
  if (match[2]) return WORD_COUNTS[match[2]] ?? Number.NaN;
  if (match[3]) return ADVERB_COUNTS[match[3]] ?? Number.NaN;
  return Number.NaN;
}

function asNeeded(text: string): boolean {
  return /\b(?:as|if|when) needed\b|\bp\.?\s?r\.?\s?n\b/.test(text);
}

function everyHours(text: string): number | null {
  const match =
    text.match(new RegExp(String.raw`\bevery ${HOURS}(?: ?(?:-|to) ?\d+(?:\.\d+)?)? ?(?:hours?|hrs?|h)\b`)) ??
    text.match(/\bq ?(\d+(?:\.\d+)?) ?h(?:rs?|ours?)?\b/);
  if (!match) return null;
  const hours = numberOf(match[1]);
  return hours > 0 ? hours : null;
}

function namedWeekdays(text: string): { days: Set<number>; listed: boolean } {
  const days = new Set<number>();
  let listed = false;
  for (const range of text.matchAll(new RegExp(String.raw`\b${WEEKDAY} ?(?:through|thru|to|-) ?${WEEKDAY}\b`, "g"))) {
    listed = true;
    const from = WEEKDAYS.indexOf(range[1]);
    const to = WEEKDAYS.indexOf(range[2]);
    for (let day = from; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === to || days.size === 7) break;
    }
  }
  for (const named of text.matchAll(new RegExp(String.raw`\b${WEEKDAY}\b`, "g"))) days.add(WEEKDAYS.indexOf(named[1]));
  for (const list of text.matchAll(SHORT_LIST)) {
    listed = true;
    for (const short of list[0].match(/[a-z]+/g) ?? []) if (short in SHORT_DAYS) days.add(SHORT_DAYS[short]);
  }
  return { days, listed: listed || days.size >= 2 };
}

/** How the label spreads doses across days. */
export type DoseDays =
  | { kind: "daily" }
  | { kind: "every"; days: number }
  | { kind: "weekdays"; days: number[] }
  | { kind: "monthly"; months: number };

export function doseDays(text: string): DoseDays {
  const t = plain(text);
  if (/\bevery other day\b|\balternate days\b|\bevery second day\b/.test(t)) return { kind: "every", days: 2 };
  const hours = everyHours(t);
  if (hours !== null && hours >= 36) return { kind: "every", days: Math.max(2, Math.round(hours / 24)) };
  const everyDays = t.match(new RegExp(String.raw`\bevery ${SMALL} days\b`));
  if (everyDays && numberOf(everyDays[1]) >= 2) return { kind: "every", days: numberOf(everyDays[1]) };

  // Named days: a list or range ("Mon/Wed/Fri", "Monday through Friday") always counts.
  // A single day counts only when nothing on the label says daily ("refill on Friday" doesn't).
  const named = namedWeekdays(t);
  if (named.days.size && named.days.size < 7 && (named.listed || !DAILY_WORDS.test(t))) {
    return { kind: "weekdays", days: [...named.days].sort((a, b) => a - b) };
  }
  if (DAILY_WORDS.test(t)) return { kind: "daily" };

  if (/\bevery other week\b|\bbiweekly\b|\bfortnight/.test(t)) return { kind: "every", days: 14 };
  const everyWeeks = t.match(new RegExp(String.raw`\bevery ${SMALL} weeks\b`));
  if (everyWeeks && numberOf(everyWeeks[1]) >= 2) return { kind: "every", days: 7 * numberOf(everyWeeks[1]) };
  const perWeek = t.match(PER_WEEK);
  if (perWeek) {
    const count = timesCount(perWeek);
    if (count >= 7) return { kind: "daily" };
    // Rounded up, so a reminder never comes more often than the label allows.
    if (count >= 1) return { kind: "every", days: Math.ceil(7 / count) };
  }
  if (/\bweekly\b|\bevery week\b|\bq\.? ?wk\b/.test(t)) return { kind: "every", days: 7 };
  if (/\bevery other month\b/.test(t)) return { kind: "monthly", months: 2 };
  const everyMonths = t.match(new RegExp(String.raw`\bevery ${SMALL} months\b`));
  if (everyMonths && numberOf(everyMonths[1]) >= 2) return { kind: "monthly", months: numberOf(everyMonths[1]) };
  if (/\bmonthly\b|\bevery month\b|\b(?:once|one time) (?:a |per |each |every )?month\b/.test(t)) return { kind: "monthly", months: 1 };
  return { kind: "daily" };
}

/** How many doses a day the label allows, or null when the wording doesn't say (for example "as needed"). */
export function dailyDoseLimit(text: string): number | null {
  const t = plain(text);
  if (asNeeded(t)) return null;
  const perDay = t.match(PER_DAY);
  if (perDay) {
    const count = timesCount(perDay);
    if (count >= 1) return count;
  }
  const hours = everyHours(t);
  if (hours !== null) return Math.max(1, Math.floor(24 / hours));
  // Weekly, every other day, or set weekdays: at most one dose on a dose day.
  if (doseDays(t).kind !== "daily") return 1;
  if (/\bq\.? ?i\.? ?d\b|\bfour times\b|\b4 ?(?:times|x)\b/.test(t)) return 4;
  if (/\bt\.? ?i\.? ?d\b|\bthree times\b|\b3 ?(?:times|x)\b|\bthrice\b/.test(t)) return 3;
  if (/\bb\.? ?i\.? ?d\b|\btwice\b|\btwo times\b|\b2 ?(?:times|x)\b/.test(t)) return 2;
  if (/\bonce\b|\bone time\b|\bdaily\b|\bevery (?:morning|evening|night|day)\b|\bat bedtime\b|\bq\.? ?d\b|\bq\.? ?h\.? ?s\b|\bq\.? ?am\b|\bq\.? ?pm\b/.test(t)) return 1;
  return null;
}

const COUNT = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`;
// Dose forms and amounts a label can count in. Each maps to one unit name, so "tabs" and "tablets" compare equal.
const UNIT_NAMES: Array<[RegExp, string]> = [
  [/^(?:times?|x|doses?)$/, "dose"],
  [/^(?:tablets?|tabs?)$/, "tablet"],
  [/^caplets?$/, "caplet"],
  [/^(?:capsules?|caps?)$/, "capsule"],
  [/^softgels?$/, "softgel"],
  [/^gelcaps?$/, "gelcap"],
  [/^pills?$/, "pill"],
  [/^puffs?$/, "puff"],
  [/^inhalations?$/, "inhalation"],
  [/^sprays?$/, "spray"],
  [/^drops?$/, "drop"],
  [/^lozenges?$/, "lozenge"],
  [/^packets?$/, "packet"],
  [/^patch(?:es)?$/, "patch"],
  [/^applications?$/, "application"],
  [/^suppositor(?:y|ies)$/, "suppository"],
  [/^(?:chews?|chewables?)$/, "chew"],
  [/^gumm(?:y|ies)$/, "gummy"],
  [/^pieces?$/, "piece"],
  [/^(?:ml|milliliters?|millilitres?)$/, "ml"],
  [/^(?:teaspoons?|tsp)$/, "tsp"],
  [/^(?:tablespoons?|tbsp)$/, "tbsp"],
  [/^(?:mg|milligrams?)$/, "mg"],
  [/^(?:mcg|micrograms?)$/, "mcg"],
  [/^(?:g|grams?)$/, "g"],
  [/^units?$/, "unit"],
];
const UNITS = String.raw`times?|x|doses?|tablets?|tabs?|caplets?|capsules?|caps?|softgels?|gelcaps?|pills?|puffs?|inhalations?|sprays?|drops?|lozenges?|packets?|patch(?:es)?|applications?|suppositor(?:y|ies)|chews?|chewables?|gumm(?:y|ies)|pieces?|ml|milliliters?|millilitres?|teaspoons?|tsp|tablespoons?|tbsp|mg|milligrams?|mcg|micrograms?|g|grams?|units?`;
// "no more than 4 doses in 24 hours", "do not exceed 6 tablets daily", "up to 3 times a day", "max 8 tablets/day",
// "or more than 4 tablets in 24 hours". Every such phrase is read, and the smallest wins.
const MAX_PREFIX = String.raw`(?:no more than|not more than|(?:do not|don't|never|or|nor) (?:take |use |give |exceed )?more than|not to exceed|(?:do not|don't|never) exceed|up to|max(?:imum)?\.?(?: dose)?(?: of)?:?)`;
const PER_PERIOD = String.raw`(?:(?:(?:a|per|in|each|every|within|in any|in a|in one|in 1|in a single|in any one|for|over) |/ ?)(?:day|24 ?-? ?hours?|24 ?-? ?hour period|24 ?hrs?|24 ?h)\b|daily\b|a day\b)`;
const MAX_PER_DAY = new RegExp(String.raw`\b${MAX_PREFIX} ${COUNT} ?(${UNITS})?\.? ?${PER_PERIOD}`, "g");
// "no more than 2 doses in 12 hours": that many in each part of the day.
const MAX_PER_HOURS = new RegExp(String.raw`\b${MAX_PREFIX} ${COUNT} ?(${UNITS})?\.? ?(?:in|within|per|every|over|in any) (\d+) ?(?:hours?|hrs?|h)\b`, "g");
// "maximum daily dose: 4 tablets", "max. per day 6 tablets"
const MAX_DAILY_FIRST = new RegExp(String.raw`\bmax(?:imum)?\.? (?:daily dose|dose per day|per day|a day|daily|in 24 hours)(?: is)?:? ${COUNT} ?(${UNITS})?\b`, "g");
// The amount in one dose: "take 1 to 2 tablets" is 2, the high end, so the cap stays on the cautious side.
const PER_DOSE = new RegExp(
  String.raw`\b(?:take|use|give|inhale|apply|chew|dissolve|place|put|insert|spray|instill|swallow|suck on|suck) (?:up to )?${COUNT}(?: ?(?:to|-|or) ?${COUNT})? ?(${UNITS})\b`,
  "g",
);
// "2 drops in each eye" with any verb, and the amount written after a dose: "2 tablets (1000 mg)".
const SIDE_DOSE = new RegExp(String.raw`\b${COUNT} ?(${UNITS}) (?:in|into) (?:each|both) (?:eyes?|nostrils?|ears?)\b`, "g");
const AMOUNT_AFTER = /^ ?\((\d+(?:\.\d+)?) ?(mg|mcg|g|ml)\)/;
// "if pain does not respond to 1 tablet, 2 tablets may be used": a larger amount allowed for one dose.
const MAY_USE = new RegExp(String.raw`\b${COUNT} ?(${UNITS}) (?:may|can) be (?:used|taken|given)\b`, "g");
// "1 drop in each eye" is two drops in one dose.
const EACH_SIDE = /^ ?(?:in|into) (?:each|both) (?:eyes?|nostrils?|ears?)\b/;

/** Amounts, not pieces: a daily maximum in these needs the amount per dose in the same unit. */
const MEASURED = new Set(["mg", "mcg", "g", "ml", "tsp", "tbsp", "unit"]);

function unitName(unit: string | undefined): string | null {
  if (!unit) return null;
  for (const [pattern, name] of UNIT_NAMES) if (pattern.test(unit)) return name;
  return null;
}

/** The longest gap the label allows between doses: "every 4 to 6 hours" is 6, so reminders stay on the cautious side. */
function slowestHours(text: string): number | null {
  const match =
    text.match(new RegExp(String.raw`\bevery ${HOURS}(?: ?(?:-|to) ?${HOURS})? ?(?:hours?|hrs?|h)\b`)) ??
    text.match(/\bq ?(\d+(?:\.\d+)?)(?: ?- ?(\d+(?:\.\d+)?))? ?h(?:rs?|ours?)?\b/);
  if (!match) return null;
  const hours = numberOf(match[2] ?? match[1]);
  return hours > 0 ? hours : null;
}

export type ReminderLimit = {
  /** How many reminder times a day may be saved, or null when the label does not limit them. */
  count: number | null;
  /** True for a medicine taken only when needed ("as needed", "PRN"). */
  asNeeded: boolean;
  /**
   * "label" when the wording sets the number. For an as-needed label: "default" when it gives no number, and
   * "unclear" when its daily maximum can't be turned into doses (such as mg per day with a dose in tablets).
   * Both cap reminders at one.
   */
  basis: "label" | "default" | "unclear";
};

/**
 * The cap on reminder times. A scheduled medicine uses the daily dose limit. A medicine taken only when needed
 * uses the smallest limit its wording gives ("no more than 4 doses in 24 hours", "every 6 hours"), and only one
 * reminder when the label gives no usable number, because a reminder should never prompt more doses than allowed.
 */
export function reminderLimit(text: string): ReminderLimit {
  const t = plain(text).replace(/\btwenty[- ]?four\b/g, "24");
  if (!asNeeded(t)) return { count: dailyDoseLimit(text), asNeeded: false, basis: "label" };
  const limits: number[] = [];
  let unclear = false;
  // The largest amount the label allows in one dose, by unit.
  const largest = new Map<string, number>();
  const note = (amount: number, unit: string | null) => {
    if (!unit || !(amount >= 1)) return;
    largest.set(unit, Math.max(largest.get(unit) ?? 0, amount));
  };
  for (const each of t.matchAll(PER_DOSE)) {
    const after = t.slice((each.index ?? 0) + each[0].length);
    const sides = EACH_SIDE.test(after) ? 2 : 1;
    note(numberOf(each[2] ?? each[1]) * sides, unitName(each[3]));
    const amount = AMOUNT_AFTER.exec(after);
    if (amount) note(Number(amount[1]), unitName(amount[2]));
  }
  for (const each of t.matchAll(SIDE_DOSE)) note(numberOf(each[1]) * 2, unitName(each[2]));
  for (const each of t.matchAll(MAY_USE)) note(numberOf(each[1]), unitName(each[2]));
  const pieces = [...largest.entries()].filter(([unit]) => unit !== "dose" && !MEASURED.has(unit));
  const maxima = [
    ...[...t.matchAll(MAX_PER_DAY), ...t.matchAll(MAX_DAILY_FIRST)].map((match) => ({ amount: numberOf(match[1]), unit: unitName(match[2]), parts: 1 })),
    ...[...t.matchAll(MAX_PER_HOURS)].map((match) => {
      const hours = Number(match[3]);
      return { amount: numberOf(match[1]), unit: unitName(match[2]), parts: hours > 0 && hours <= 24 ? Math.floor(24 / hours) : 0 };
    }),
  ];
  for (const max of maxima) {
    if (!(max.amount >= 1) || !(max.parts >= 1)) continue;
    const total = max.amount * max.parts;
    if (max.unit === "dose") {
      limits.push(total);
    } else if (max.unit === null) {
      // "Max 6 per day": count each as a dose, and as pieces when one dose is several pieces.
      limits.push(total);
      for (const [, amount] of pieces) limits.push(Math.max(1, Math.floor(total / amount)));
    } else if (largest.has(max.unit)) {
      limits.push(Math.max(1, Math.floor(total / largest.get(max.unit)!)));
    } else if (!largest.size && !MEASURED.has(max.unit)) {
      // "Do not exceed 4 tablets a day" with no amount per dose: count each tablet as a dose.
      limits.push(total);
    } else {
      unclear = true;
    }
  }
  const perDay = t.match(PER_DAY);
  if (perDay) {
    const count = timesCount(perDay);
    if (count >= 1) limits.push(count);
  }
  const hours = slowestHours(t);
  if (hours !== null) limits.push(Math.max(1, Math.floor(24 / hours)));
  if (unclear) return { count: 1, asNeeded: true, basis: "unclear" };
  if (!limits.length) return { count: 1, asNeeded: true, basis: "default" };
  return { count: Math.min(...limits), asNeeded: true, basis: "label" };
}

function doses(count: number): string {
  return count === 1 ? "1 dose" : `${count} doses`;
}

function dayNumber(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

function anchorDay(med: DatedMedication): string | null {
  if (med.startDate && dayNumber(med.startDate) !== null) return med.startDate.slice(0, 10);
  if (med.createdAt) {
    const created = new Date(med.createdAt);
    if (!Number.isNaN(created.getTime())) return localDate(created);
  }
  return null;
}

/**
 * Whether a dose is due on this local day (YYYY-MM-DD). Nothing is due before the start date
 * or after the end date. A weekly medicine is due on the weekday it started, "every other day"
 * counts from the start, and weekdays named on the label are used as written.
 */
export function isDoseDay(med: DatedMedication, day: string): boolean {
  const today = dayNumber(day);
  if (today === null) return true;
  const start = anchorDay(med);
  const first = start ? dayNumber(start) : null;
  if (first !== null && today < first) return false;
  const last = med.endDate ? dayNumber(med.endDate) : null;
  if (last !== null && today > last) return false;
  const schedule = doseDays(`${med.instructions} ${med.frequency}`);
  if (schedule.kind === "daily") return true;
  if (schedule.kind === "weekdays") return schedule.days.includes(new Date(today * 86_400_000).getUTCDay());
  if (first === null) return true;
  if (schedule.kind === "every") return (today - first) % schedule.days === 0;
  const startDate = new Date(first * 86_400_000);
  const date = new Date(today * 86_400_000);
  const months = (date.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + date.getUTCMonth() - startDate.getUTCMonth();
  if (months % schedule.months !== 0) return false;
  const lastOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return date.getUTCDate() === Math.min(startDate.getUTCDate(), lastOfMonth);
}

/** Why the listed reminder times do not match the prescription, or null when they do. */
export function reminderCountReason(instructions: string, frequency: string, times: string[]): string | null {
  const limit = reminderLimit(`${instructions} ${frequency}`);
  if (limit.count === null || times.length <= limit.count) return null;
  if (limit.asNeeded && limit.basis !== "label") {
    const why = limit.basis === "unclear" ? "its daily maximum could not be read as a number of doses" : "the label does not say how many doses a day are allowed";
    return `This medicine is taken only when needed, and ${why}, so only 1 reminder time can be saved. ${times.length} are listed. Ask a pharmacist before adding more.`;
  }
  if (limit.asNeeded) {
    return `This medicine is taken only when needed, and the label allows at most ${doses(limit.count)} a day, but ${times.length} reminder times are listed. Match the reminder times to the wording.`;
  }
  return `This prescription allows ${doses(limit.count)} a day, but ${times.length} reminder times are listed. Match the reminder times to the wording.`;
}

/** Why a new reminder time must not be added, or null if it is safe to offer. */
export function reminderBlockReason(med: ScheduledMedication, time: string): string | null {
  if (med.times.includes(time)) return `There is already a reminder at ${formatTime(time)} for ${med.name}.`;
  const limit = reminderLimit(`${med.instructions} ${med.frequency}`);
  if (limit.count === null || med.times.length < limit.count) return null;
  const current = med.times.map(formatTime).join(" and ");
  const already = `there ${med.times.length === 1 ? "is already a reminder" : `are already ${med.times.length} reminders`} at ${current}`;
  const label = `The label for ${med.name} says “${med.instructions.trim().replace(/\.$/, "")}”`;
  if (limit.asNeeded) {
    const cap =
      limit.basis === "default"
        ? "It is taken only when needed and the label does not say how often, so one reminder is the most that can be saved"
        : limit.basis === "unclear"
          ? "It is taken only when needed and its daily maximum could not be read as a number of doses, so one reminder is the most that can be saved"
          : `It is taken only when needed, at most ${doses(limit.count)} a day`;
    return `${label}. ${cap}, and ${already}. Another reminder could lead to an extra dose, so none was added. Ask a pharmacist before adding reminders to a medicine taken only when needed.`;
  }
  return `${label}, and ${already}. Another reminder could lead to an extra dose, so none was added. If a different time works better, move the existing reminder instead of adding one, and check with a pharmacist first if the label names a time of day.`;
}
