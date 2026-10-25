import { dailyDoseLimit } from "@/lib/medications/schedule";

/**
 * Dose amounts in free text, so AI wording can be checked against the saved record.
 *
 * An amount is a number with a dose unit: "20 mg", "2 tablets", "1,000 IU".
 * Spelled-out numbers and long unit names count too ("two tablets", "20 milligrams").
 * Tablets, capsules, and pills are compared as the same kind of unit.
 * Lab results such as "162 mg/dL" are not doses and are left out.
 */

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const NUMBER_WORD = [...Object.keys(SMALL_NUMBERS), "hundred", "thousand"].join("|");
// "five hundred", "twenty-five", "one thousand and fifty"
const NUMBER_PHRASE = new RegExp(String.raw`\b(?:${NUMBER_WORD})(?:[\s-]+(?:and[\s-]+)?(?:${NUMBER_WORD}))*\b`, "g");

function phraseValue(phrase: string): string {
  let total = 0;
  let current = 0;
  for (const word of phrase.split(/[\s-]+/)) {
    if (word === "and") continue;
    if (word in SMALL_NUMBERS) current += SMALL_NUMBERS[word];
    else if (word === "hundred") current = (current || 1) * 100;
    else if (word === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
    }
  }
  return String(total + current);
}

const UNIT_NAMES: Record<string, string> = {
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  mcg: "mcg",
  "µg": "mcg",
  "μg": "mcg",
  ug: "mcg",
  microgram: "mcg",
  micrograms: "mcg",
  g: "g",
  gram: "g",
  grams: "g",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  cc: "ml",
  unit: "unit",
  units: "unit",
  iu: "iu",
  tablet: "dose",
  tablets: "dose",
  tab: "dose",
  tabs: "dose",
  capsule: "dose",
  capsules: "dose",
  cap: "dose",
  caps: "dose",
  caplet: "dose",
  caplets: "dose",
  softgel: "dose",
  softgels: "dose",
  pill: "dose",
  pills: "dose",
  puff: "puff",
  puffs: "puff",
  drop: "drop",
  drops: "drop",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  patch: "patch",
  patches: "patch",
  spray: "spray",
  sprays: "spray",
};

// Longest names first, so "milligrams" wins over shorter names.
const UNIT = Object.keys(UNIT_NAMES)
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const NUMBER = String.raw`\d+(?:\.\d+)?`;
const STRENGTH = String.raw`(?:mg|mcg|µg|μg|g|ml|iu|units?)`;
const SOLID = String.raw`(?:tablets?|tabs?|capsules?|caps?|caplets?|softgels?|pills?)`;

// "20 mg", "1 to 2 tablets". Not "162 mg/dL", which is a lab result.
const SIMPLE = new RegExp(String.raw`(?<![\w.])(${NUMBER})(?:\s*(?:-|–|to|or)\s*(${NUMBER}))?\s*(${UNIT})(?![\w])(?!\s*\/\s*[a-z])`, "g");
// "one 10 mg tablet": the count of tablets is the first number.
const COUNTED = new RegExp(String.raw`(?<![\w.])(${NUMBER})\s+${NUMBER}\s*${STRENGTH}\s+(${SOLID})(?![\w])`, "g");
// "two lisinopril tablets", "2 of your tablets"
const WORDED = new RegExp(String.raw`(?<![\w.])(${NUMBER})\s+((?:[a-z][a-z'-]*\s+){1,2})(${SOLID})(?![\w])`, "g");
// "half a tablet"
const HALF = new RegExp(String.raw`(?<![\w.])0\.5\s+an?\s+(${SOLID})(?![\w])`, "g");
// Words that start a new phrase, so "day 2 take your tablets" is not "2 tablets".
const NOT_BETWEEN = new Set(["take", "takes", "taking", "took", "and", "or", "then", "with", "at", "on", "in", "by", "before", "after", "for", "every", "each", "per", "times", "time", "day", "days", "hours", "weeks"]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/½/g, " 0.5")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, (_match, top: string, bottom: string) => {
      const value = Number(top) / Number(bottom);
      return Number.isFinite(value) ? String(value) : `${top}/${bottom}`;
    })
    .replace(/\bhalf\b/g, "0.5")
    .replace(NUMBER_PHRASE, (phrase) => phraseValue(phrase));
}

function amount(value: string, unit: string): string {
  return `${Number(value)} ${UNIT_NAMES[unit] ?? unit}`;
}

type Located = { amount: string; start: number; end: number };

/** Amounts with where they sit in normalized text. */
function locate(clean: string): Located[] {
  const found: Located[] = [];
  const at = (match: RegExpMatchArray) => ({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  for (const match of clean.matchAll(SIMPLE)) {
    found.push({ amount: amount(match[1], match[3]), ...at(match) });
    if (match[2]) found.push({ amount: amount(match[2], match[3]), ...at(match) });
  }
  for (const match of clean.matchAll(COUNTED)) found.push({ amount: amount(match[1], match[2]), ...at(match) });
  for (const match of clean.matchAll(WORDED)) {
    const between = match[2].trim().split(/\s+/);
    if (between.some((word) => NOT_BETWEEN.has(word) || word in UNIT_NAMES)) continue;
    found.push({ amount: amount(match[1], match[3]), ...at(match) });
  }
  for (const match of clean.matchAll(HALF)) found.push({ amount: amount("0.5", match[1]), ...at(match) });
  return found;
}

/** Every dose amount in the text, like "20 mg" or "2 dose". */
export function doseAmounts(text: string): string[] {
  return [...new Set(locate(normalize(text)).map((item) => item.amount))];
}

const DOSE_CHANGE = [
  /\b(?:take|taking|took|have|use|add)\s+(?:an?\s+|one\s+)?(?:extra|additional|double)\s+(?:dose|tablet|pill|capsule|puff|drop)s?\b/g,
  /\bdouble\s+(?:up\s+)?(?:on\s+)?(?:the\s+|your\s+|a\s+)?dose\b/g,
  /\b(?:increase|raise|decrease|lower|reduce|cut)\s+(?:the\s+|your\s+)?(?:dose|dosage)\b/g,
];
const NEGATION = /\b(?:not|never|don't|dont|no|avoid|without|unless)\b/;
const DEFERRAL = /\b(?:ask|check with|talk (?:to|with)|call|only (?:your |a )?(?:doctor|clinician|pharmacist|prescriber|nurse))\b/;

/** Wording that tells someone to change how much they take, unless the source already says it. */
export function suggestsDoseChange(output: string, source: string): boolean {
  const known = source.toLowerCase();
  for (const sentence of output.toLowerCase().split(/(?<=[.!?;])\s+|\n+/)) {
    for (const pattern of DOSE_CHANGE) {
      for (const match of sentence.matchAll(pattern)) {
        const before = sentence.slice(0, match.index ?? 0);
        if (NEGATION.test(before) || DEFERRAL.test(sentence)) continue;
        if (known.includes(match[0])) continue;
        return true;
      }
    }
  }
  return false;
}

/** True when the output names an amount that is not in the source, or says to change a dose. */
export function inventsAmounts(output: string, source: string): boolean {
  const known = new Set(doseAmounts(source));
  return doseAmounts(output).some((item) => !known.has(item)) || suggestsDoseChange(output, source);
}

export type MedicineText = { id?: string; name: string; text: string };

// Words in a medicine name that say its form, not which medicine it is.
const FORM_WORDS = new Set([
  "tablet", "tablets", "capsule", "capsules", "oral", "solution", "suspension", "extended", "release", "delayed",
  "chewable", "cream", "ointment", "patch", "injection", "inhaler", "spray", "drops", "liquid", "syrup", "film",
  "coated", "caplet", "softgel", "dose", "daily",
]);

function nameKeys(name: string): string[] {
  const words = name
    .toLowerCase()
    .split(/\d/)[0]
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((word) => word.length >= 4 && !FORM_WORDS.has(word));
  return [...new Set(words)];
}

type Mention = { medicines: MedicineText[]; start: number; end: number };

/** Where each medicine is named in normalized text. Names at the same spot are grouped. */
function mentionsIn(clean: string, medicines: MedicineText[]): Mention[] {
  const spots = new Map<string, Mention>();
  for (const medicine of medicines) {
    for (const key of nameKeys(medicine.name)) {
      for (const match of clean.matchAll(new RegExp(`(?<![a-z])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "g"))) {
        const start = match.index ?? 0;
        const spot = spots.get(String(start)) ?? { medicines: [], start, end: start + match[0].length };
        if (!spot.medicines.includes(medicine)) spot.medicines.push(medicine);
        spots.set(String(start), spot);
      }
    }
  }
  return [...spots.values()].sort((a, b) => a.start - b.start);
}

/** The medicine an amount is said about: the nearest name, or the one right after "of". */
function boundTo(clean: string, item: Located, mentions: Mention[]): Mention | null {
  const before = [...mentions].reverse().find((mention) => mention.end <= item.start) ?? null;
  const after = mentions.find((mention) => mention.start >= item.end) ?? null;
  if (after && /^\s*(?:of|for)\s+(?:your\s+|the\s+|her\s+|his\s+)?$/.test(clean.slice(item.end, after.start))) return after;
  if (!before) return after;
  if (!after) return before;
  return after.start - item.end < item.start - before.end ? after : before;
}

function labelLimit(medicines: MedicineText[]): number | null {
  const limits = medicines.map((medicine) => dailyDoseLimit(medicine.text));
  if (limits.some((limit) => limit === null)) return null;
  return Math.max(...(limits as number[]));
}

/**
 * True when an amount or a schedule is tied to a medicine whose own label does not say it,
 * for example "Take 20 mg of lisinopril" when only atorvastatin is 20 mg, or "lisinopril
 * twice a day" when the label says once. A sentence that names no medicine is checked
 * against the last medicine named, or against `defaultIds` before any is named.
 */
export function misattributesAmounts(output: string, medicines: MedicineText[], defaultIds: string[] = []): boolean {
  if (!medicines.length) return false;
  let current = medicines.filter((medicine) => medicine.id && defaultIds.includes(medicine.id));
  for (const sentence of output.split(/(?<=[.!?;:])\s+|\n+/)) {
    const clean = normalize(sentence);
    const mentions = mentionsIn(clean, medicines);
    for (const item of locate(clean)) {
      const bound = mentions.length ? (boundTo(clean, item, mentions)?.medicines ?? current) : current;
      if (!bound.length) continue;
      const allowed = new Set(bound.flatMap((medicine) => doseAmounts(`${medicine.name}\n${medicine.text}`)));
      if (!allowed.has(item.amount)) return true;
    }
    const named = mentions.length ? [...new Set(mentions.flatMap((mention) => mention.medicines))] : current;
    const said = dailyDoseLimit(sentence);
    const label = named.length ? labelLimit(named) : null;
    if (said !== null && label !== null && said > label) return true;
    if (mentions.length) current = mentions[mentions.length - 1].medicines;
  }
  return false;
}
