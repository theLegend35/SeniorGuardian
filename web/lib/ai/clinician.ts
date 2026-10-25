import { z } from "zod";

import { misattributesAmounts, type MedicineText } from "@/lib/ai/amounts";
import { anomalyReview, flaggedLines } from "@/lib/ai/anomalies";
import { parseTime } from "@/lib/ai/chat";
import { aiConfig, appendLimitNote, generateObject, imagePart, type ImageInput } from "@/lib/ai/provider";
import { inventsAmounts } from "@/lib/ai/service";
import type { HistoryTurn } from "@/lib/ai/types";
import { formatWhen, localDate, startOfNextLocalDay, zonedTime } from "@/lib/time";
import type { ProposedAction } from "@/types/domain";

const STOP = new Set(["what", "does", "this", "that", "with", "from", "have", "about", "their", "there", "which", "when", "where", "your", "show", "tell", "please", "record", "records", "analyze", "analysis"]);

const QuoteSchema = z.object({
  quotes: z.array(z.string()).max(6),
});

function keptQuotes(source: string, quotes: string[]): string[] {
  const known = source.toLowerCase().replace(/\s+/g, " ");
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const quote of quotes) {
    const trimmed = quote.replace(/\s+/g, " ").trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length < 4 || trimmed.length > 240 || !known.includes(key) || seen.has(key)) continue;
    if (inventsAmounts(trimmed, source)) continue;
    seen.add(key);
    lines.push(trimmed);
    if (lines.length === 6) break;
  }
  return lines;
}

export function linesAbout(question: string, source: string): string[] {
  const words = question.toLowerCase().match(/[a-z0-9]{4,}/g)?.filter((word) => !STOP.has(word)) ?? [];
  if (!words.length) return flaggedLines(source);
  const hits: string[] = [];
  for (const line of source.split(/\n+/)) {
    const trimmed = line.replace(/\s+/g, " ").trim();
    if (trimmed.length < 4 || trimmed.length > 240) continue;
    const lower = trimmed.toLowerCase();
    if (!words.some((word) => lower.includes(word))) continue;
    hits.push(trimmed);
    if (hits.length === 6) break;
  }
  return hits;
}

export function rulesReply(question: string, source: string, focus: string): string {
  const asked = question.trim();
  const body = focus || source;
  if (!asked || /\banalyz/i.test(asked)) return anomalyReview(body);
  const focusHits = focus ? linesAbout(asked, focus) : [];
  const hits = focusHits.length ? focusHits : linesAbout(asked, source);
  if (!hits.length) return "That is not in the saved records you can see. This is not a diagnosis. The original record is unchanged.";
  return ["From the saved record", ...hits.map((line) => `• ${line}`), "", "These lines are copied from the record. This is not a diagnosis. The original record is unchanged."].join("\n");
}

export async function answerClinician(question: string, source: string, focus = ""): Promise<{ text: string; source: "ai" | "rules" }> {
  const rules = rulesReply(question, source, focus);
  const asked = question.trim();
  if (!asked || /\banalyz/i.test(asked) || !aiConfig().configured) return { text: rules, source: "rules" };
  const result = await generateObject(
    [
      {
        role: "system",
        content:
          "You answer a clinician using only the saved record. quotes must be exact lines copied from the record. Do not add a dose, a reference range, a diagnosis, or a treatment. If the record does not say it, return an empty quotes list.",
      },
      { role: "user", content: `Question: ${asked.slice(0, 500)}\n\nSaved record:\n"""${source.slice(0, 12000)}"""` },
    ],
    QuoteSchema,
    "clinician_record_quotes",
    { maxTokens: 1200 },
  );
  const quotes = result ? keptQuotes(source, result.quotes) : [];
  if (!quotes.length) return { text: appendLimitNote(rules), source: "rules" };
  const text = ["From the saved record", ...quotes.map((line) => `• ${line}`), "", "These lines are copied from the record. This is not a diagnosis. The original record is unchanged."].join("\n");
  if (inventsAmounts(text, source)) return { text: appendLimitNote(rules), source: "rules" };
  return { text: appendLimitNote(text), source: "ai" };
}

const ClinicianSchema = z.object({
  reply: z.string(),
  action: z.object({
    type: z.enum(["none", "add_appointment", "add_note"]),
    patientId: z.string(),
    provider: z.string(),
    specialty: z.string(),
    startsAt: z.string(),
    location: z.string(),
    note: z.string(),
  }),
});

export type ClinicianPatientRef = { id: string; name: string };

export type SavedVisit = {
  patientName: string;
  startsAt: string;
  location: string;
};

function clinicName(location: string): string {
  return location.split(",")[0]?.trim() ?? "";
}

export function scheduleReply(visits: SavedVisit[], now = new Date()): string {
  const upcoming = visits
    .filter((visit) => {
      const starts = new Date(visit.startsAt);
      return !Number.isNaN(starts.getTime()) && starts.getTime() >= now.getTime() - 60 * 60 * 1000;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.patientName.localeCompare(b.patientName));
  if (!upcoming.length) return "Nobody on your list has an upcoming visit saved.";
  const grouped = new Map<string, SavedVisit[]>();
  for (const visit of upcoming) {
    const list = grouped.get(visit.patientName) ?? [];
    list.push(visit);
    grouped.set(visit.patientName, list);
  }
  return [...grouped.entries()]
    .map(([name, items]) => {
      const when = items.map((visit) => formatWhen(visit.startsAt));
      const places = [...new Set(items.map((visit) => clinicName(visit.location)).filter(Boolean))];
      const place = places.length === 1 ? (items.length > 1 ? `, both at ${places[0]}` : `, ${places[0]}`) : "";
      const times = when.length === 2 ? `${when[0]}, and ${when[1]}` : when.join(", ");
      return `${name}: ${times}${place}.`;
    })
    .join("\n");
}

function asksForSchedule(question: string): boolean {
  return /\b(visit|appointment)s?\b/i.test(question) && /\b(who|list|upcoming|coming|when|have|schedule)\b/i.test(question);
}

function isGreeting(question: string): boolean {
  return /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay)[.!\s]*$/i.test(question.trim());
}

/** A direct answer for the clinician chat. Record quotes stay on the document path. */
export function clinicianFallback(question: string, chart: string, visits: SavedVisit[] = []): string {
  const asked = question.trim();
  if (isGreeting(asked)) return "Hello. Ask who has a visit coming up, or about a medicine or a file on a chart you can open.";
  if (asksForSchedule(asked)) return scheduleReply(visits);
  const rules = rulesReply(asked, chart, "");
  if (rules.startsWith("That is not in the saved records")) return "I don't see that in the charts you can open.";
  return rules.replace(/\n\nThese lines are copied from the record\. This is not a diagnosis\. The original record is unchanged\.$/, "");
}

function namedPatient(question: string, patients: ClinicianPatientRef[]): ClinicianPatientRef | null {
  const lower = question.toLowerCase();
  const hits = patients.filter((patient) => patient.name && lower.includes(patient.name.toLowerCase()));
  if (hits.length === 1) return hits[0];
  if (patients.length === 1) return patients[0];
  return null;
}

function visitStart(question: string): string | null {
  const clock = parseTime(question) ?? "09:00";
  const iso = question.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return `${iso[1]}T${clock}`;
  if (/\btomorrow\b/i.test(question)) return `${localDate(startOfNextLocalDay())}T${clock}`;
  return null;
}

/** A visit or note is drafted only from the clinician's own words and an authorized patient. */
export function draftClinicianRequest(question: string, patients: ClinicianPatientRef[]): ProposedAction | null {
  const patient = namedPatient(question, patients);
  if (!patient) return null;
  const note = question.match(/\b(?:add|save|write)\s+(?:a\s+)?note\b[:\s-]+([\s\S]+)$/i);
  if (note?.[1]?.trim() && !/\b(visit|appointment)\b/i.test(question)) {
    const body = note[1].replace(new RegExp(`\\bfor\\s+${patient.name}\\b`, "i"), "").replace(/^[:\s-]+/, "").trim().slice(0, 2000);
    if (!body) return null;
    return { type: "add_note", body, patientId: patient.id, patientName: patient.name };
  }
  if (!/\b(schedule|set|book|add|draft|create)\b/i.test(question) || !/\b(visit|appointment)\b/i.test(question)) return null;
  const provider = question.match(/\bwith\s+(.+?)(?=\s+on\b|\s+at\b|\s+for\b|$)/i)?.[1]?.trim();
  const startsAt = visitStart(question);
  if (!provider || !startsAt) return null;
  const starts = wallClock(startsAt);
  if (!starts || starts.getTime() < Date.now() - 60_000) return null;
  const location = question.match(/\bat\s+([A-Z][^.\n]{2,80}?)\s*$/)?.[1]?.trim() ?? "";
  return {
    type: "add_appointment",
    provider: provider.slice(0, 160),
    specialty: "",
    startsAt: starts.toISOString(),
    location: location.slice(0, 200),
    questions: [],
    patientId: patient.id,
    patientName: patient.name,
  };
}

function draftCopy(action: ProposedAction): string {
  if (action.type === "add_appointment") {
    return `I can add a visit with ${action.provider} for ${action.patientName ?? "this patient"} on ${formatWhen(action.startsAt)}${action.location ? ` at ${action.location}` : ""}. Nothing is saved until you confirm.`;
  }
  if (action.type === "add_note" && action.patientName) {
    return `I can save this note on ${action.patientName}'s chart after you confirm.`;
  }
  return "Nothing is saved until you confirm.";
}

/** The clock time in the clinician's request is Central time, even when a model adds a Z. */
export function wallClock(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!match) return null;
  return zonedTime(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]));
}

function clinicianAction(action: z.infer<typeof ClinicianSchema>["action"], patients: ClinicianPatientRef[]): ProposedAction | null {
  const patient = patients.find((item) => item.id === action.patientId);
  if (!patient) return null;
  if (action.type === "add_note") {
    const body = action.note.trim().slice(0, 2000);
    if (!body) return null;
    return { type: "add_note", body, patientId: patient.id, patientName: patient.name };
  }
  if (action.type === "add_appointment") {
    const starts = wallClock(action.startsAt);
    if (!action.provider.trim() || !starts || starts.getTime() < Date.now() - 60_000) return null;
    return {
      type: "add_appointment",
      provider: action.provider.trim().slice(0, 160),
      specialty: action.specialty.trim().slice(0, 120),
      startsAt: starts.toISOString(),
      location: action.location.trim().slice(0, 200),
      questions: [],
      patientId: patient.id,
      patientName: patient.name,
    };
  }
  return null;
}

export async function clinicianAssistantReply(input: {
  question: string;
  chart: string;
  patients: ClinicianPatientRef[];
  visits?: SavedVisit[];
  history: HistoryTurn[];
  image?: ImageInput | null;
  /** Active medicines on the charts, so an amount can be checked against its own label. */
  medicines?: MedicineText[];
}): Promise<{ text: string; source: "ai" | "rules"; proposedAction: ProposedAction | null }> {
  const rules = clinicianFallback(input.question, input.chart, input.visits ?? []);
  const asked = input.question.trim();
  const drafted = draftClinicianRequest(asked, input.patients);
  if (!asked || !aiConfig().configured) {
    return drafted ? { text: draftCopy(drafted), source: "rules", proposedAction: drafted } : { text: rules, source: "rules", proposedAction: null };
  }
  const roster = input.patients.map((patient) => `${patient.id} ${patient.name}`).join("\n");
  const photo = input.image ? imagePart(input.image) : null;
  const result = await generateObject(
    [
      {
        role: "system",
        content:
          "You assist a clinician looking at charts their patients chose to share. Write like a calm colleague: direct, respectful, and brief. Lead with the answer. Use the patient's name and the saved time. Do not sound scripted. Do not count how many patients gave access. Do not add a closing line about doses, diagnoses, or unchanged records. Quote a label only when they ask what it says, and quote it exactly. Do not invent a dose, a reference range, a diagnosis, or a treatment. Do not change a medicine. A visit or note is only a draft until they confirm it. patientId must be copied from the authorized list. For a visit, startsAt is the wall-clock time they asked for, written as YYYY-MM-DDTHH:MM with no timezone. If a photo is attached, describe only what is visible. If they describe an emergency, say to call 911. A greeting gets a short hello and one offer to look something up.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Authorized patients:\n${roster}\n\nSaved charts:\n"""${input.chart.slice(0, 14000)}"""\n\nRecent chat:\n${input.history
              .slice(-6)
              .map((turn) => `${turn.role}: ${turn.content.slice(0, 500)}`)
              .join("\n")}\n\nQuestion:\n${asked.slice(0, 2000)}${photo ? "\nA photo is attached." : ""}`,
          },
          ...(photo ? [photo] : []),
        ],
      },
    ],
    ClinicianSchema,
    "clinician_assistant",
    { maxTokens: 1600 },
  );
  if (
    !result?.reply.trim() ||
    inventsAmounts(result.reply, `${input.chart}\n${asked}`) ||
    misattributesAmounts(result.reply, input.medicines ?? [])
  ) {
    return drafted
      ? { text: appendLimitNote(draftCopy(drafted)), source: "rules", proposedAction: drafted }
      : { text: appendLimitNote(rules), source: "rules", proposedAction: null };
  }
  return { text: appendLimitNote(result.reply.trim()), source: "ai", proposedAction: clinicianAction(result.action, input.patients) ?? drafted };
}
