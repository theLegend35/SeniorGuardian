import { misattributesAmounts, type MedicineText } from "@/lib/ai/amounts";
import { appendLimitNote, generateText, type ChatMessage } from "@/lib/ai/provider";
import { safetyResponse } from "@/lib/ai/safety";
import { inventsAmounts } from "@/lib/ai/service";
import { getStore } from "@/lib/data/index";
import { formatWhen } from "@/lib/time";
import type { Actor } from "@/types/domain";

const SYSTEM = `You help a family caregiver understand health records that were shared with them.
Use only the shared record below. If a line says a section was not shared, say that in plain words.
Quote a medicine label exactly when you mention that medicine. Do not invent a dose, a diagnosis, or a number that is not written below.
Do not tell them to start, stop, or change a medicine.
If they ask for a pharmacy, clinic, hospital, or urgent care, tell them to open Find care.
If the question could be an emergency, tell them to call 911.
Write in warm, short sentences for an adult who is helping a parent. Answer first. Stay under 140 words.

Shared record:
`;

type Person = { name: string; lines: string[] };
type Medicine = { name: string; label: string; times: string };

function people(brief: string): Person[] {
  const blocks: Person[] = [];
  for (const line of brief.split("\n")) {
    if (line.startsWith("Person: ")) blocks.push({ name: line.slice("Person: ".length), lines: [] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(line);
  }
  return blocks;
}

function named(question: string, blocks: Person[]): Person[] {
  const q = question.toLowerCase();
  const hits = blocks.filter((block) => {
    const name = block.name.toLowerCase();
    const first = name.split(" ")[0] ?? "";
    return q.includes(name) || (first.length > 2 && q.includes(first));
  });
  return hits.length ? hits : blocks;
}

function medicines(lines: string[]): Medicine[] {
  const found: Medicine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.startsWith("Medicine: ")) continue;
    const label = lines[index + 1]?.startsWith("Label: ") ? lines[index + 1].slice("Label: ".length) : "";
    const times = lines[index + 2]?.startsWith("Reminder times: ") ? lines[index + 2].slice("Reminder times: ".length) : "";
    found.push({ name: line.slice("Medicine: ".length), label, times });
  }
  return found;
}

function morningMedicine(medicine: Medicine): boolean {
  return /08:00/.test(medicine.times) || /morning|breakfast/i.test(`${medicine.label} ${medicine.times}`);
}

export function rulesReply(question: string, brief: string): string {
  const q = question.toLowerCase();
  if (/pharmac|urgent care|hospital|\bclinic\b|find care|nearby|directions/.test(q)) {
    return "Open Find care for a pharmacy, urgent care, a hospital, or a clinic nearby. That page shows distance and today's hours. If this is an emergency, call 911.";
  }
  const blocks = named(question, people(brief));
  const names = blocks.map((block) => block.name).filter(Boolean);
  const who = names.length ? names.join(" and ") : "the people you help";
  if (/medicine|medication|pill|tablet|capsule|morning|evening|bedtime|label|\bdose\b/.test(q)) {
    const morning = /morning|breakfast/.test(q);
    const lines: string[] = [];
    for (const block of blocks) {
      const list = medicines(block.lines).filter((medicine) => (morning ? morningMedicine(medicine) : true));
      for (const medicine of list) {
        lines.push(`${block.name}: ${medicine.name}. The label says: “${medicine.label}”`);
      }
    }
    if (!lines.length) {
      return morning
        ? `No morning medicine was shared for ${who}. A hidden section stays hidden until they turn it on.`
        : `No medicine labels were shared for ${who}. They choose that from their care team.`;
    }
    const lead = morning ? "These morning medicines were shared." : "These medicines were shared.";
    return `${lead}\n\n${lines.join("\n\n")}\n\nI can explain those words. I cannot change a dose.`;
  }
  if (/visit|appointment|calendar|drive/.test(q)) {
    const lines = blocks.flatMap((block) => block.lines.filter((line) => line.startsWith("Visit: ")).map((line) => `${block.name}: ${line.slice("Visit: ".length)}`));
    if (!lines.length) return `No visits were shared for ${who}.`;
    return `These visits were shared:\n\n${lines.join("\n")}`;
  }
  if (/heart|sleep|steps|oxygen|device|ring|watch/.test(q)) {
    const lines = blocks.flatMap((block) => block.lines.filter((line) => line.startsWith("Device ")).map((line) => `${block.name}: ${line}`));
    if (!lines.length) return `No device numbers were shared for ${who}. A number outside a saved range is a signal to look, not a diagnosis.`;
    return `${lines.join("\n")}\n\nA number outside a saved range is a signal to look, not a diagnosis. If someone feels unwell, contact a clinician. In an emergency, call 911.`;
  }
  if (/note|doctor said|dr\.?\s/.test(q)) {
    const lines = blocks.flatMap((block) => block.lines.filter((line) => line.startsWith("Note from ")).map((line) => `${block.name}: ${line}`));
    if (!lines.length) return `No clinician notes were shared for ${who}.`;
    return lines.join("\n\n");
  }
  return `I can explain what ${who} shared: medicines, visits, notes, and device numbers when those sections are on. Ask about a morning medicine or the next visit, or open Find care for a pharmacy nearby. I cannot change a dose. In an emergency, call 911.`;
}

export async function sharedRecord(actor: Actor): Promise<string> {
  const store = await getStore();
  const cards = await store.listPatientCards(actor);
  if (!cards.length) return "No records have been shared with this caregiver.";
  const blocks: string[] = [];
  for (const card of cards) {
    const chart = await store.getChart(actor, card.patientId);
    const lines = [`Person: ${chart.profile.fullName}`];
    if (chart.patient.dateOfBirth) lines.push(`Born: ${chart.patient.dateOfBirth}`);
    if (chart.patient.conditions) lines.push(`Conditions: ${chart.patient.conditions}`);
    if (chart.patient.allergies) lines.push(`Allergies: ${chart.patient.allergies}`);
    if (chart.medications) {
      const active = chart.medications.filter((medicine) => medicine.status === "active");
      if (!active.length) lines.push("Medicines: none active were shared.");
      for (const medicine of active) {
        lines.push(`Medicine: ${medicine.name}`);
        lines.push(`Label: ${medicine.instructions}`);
        if (medicine.times.length) lines.push(`Reminder times: ${medicine.times.join(", ")}`);
      }
    } else lines.push("Medicines: not shared.");
    if (chart.appointments) {
      const visits = chart.appointments.filter((visit) => visit.status !== "archived");
      if (!visits.length) lines.push("Visits: none shared.");
      for (const visit of visits) {
        lines.push(`Visit: ${[visit.provider, visit.specialty, formatWhen(visit.startsAt), visit.location, visit.notes].filter(Boolean).join(", ")}`);
      }
    } else lines.push("Visits: not shared.");
    if (chart.notes) {
      if (!chart.notes.length) lines.push("Notes: none saved.");
      for (const note of chart.notes) lines.push(`Note from ${note.authorName}: ${note.body}`);
    } else lines.push("Notes: not shared.");
    if (chart.concerns) {
      for (const concern of chart.concerns) lines.push(`Concern in their words: ${concern.description}`);
    }
    const canReadings = chart.access === "full" || chart.access.viewReadings;
    if (canReadings) {
      const board = await store.getDeviceBoard(actor, card.patientId);
      const latest = new Map<string, (typeof board.readings)[number]>();
      for (const reading of board.readings) {
        const previous = latest.get(reading.metric);
        if (!previous || reading.recordedAt > previous.recordedAt) latest.set(reading.metric, reading);
      }
      if (!latest.size) lines.push("Device readings: none saved.");
      for (const reading of latest.values()) {
        const name = reading.metric.replace(/_/g, " ");
        lines.push(`Device ${name}: ${reading.value} ${reading.unit}${reading.status === "outside" ? " (outside the saved range)" : ""}`);
      }
    } else lines.push("Device readings: not shared.");
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n").slice(0, 12000);
}

/** The medicines in a brief written by sharedRecord: a "Medicine:" line followed by its "Label:" line. */
export function medicinesInBrief(brief: string): MedicineText[] {
  const lines = brief.split("\n");
  const medicines: MedicineText[] = [];
  lines.forEach((line, index) => {
    const name = line.match(/^Medicine: (.+)$/)?.[1];
    if (!name) return;
    const label = lines[index + 1]?.match(/^Label: (.+)$/)?.[1] ?? "";
    medicines.push({ name, text: label });
  });
  return medicines;
}

export async function caregiverAssistantReply(
  question: string,
  brief: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ content: string; source: "ai" | "rules" | "safety" }> {
  const safety = safetyResponse(question);
  if (safety) return { content: safety, source: "safety" };
  const rules = rulesReply(question, brief);
  const messages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM}${brief}` },
    ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: question },
  ];
  const answer = await generateText(messages, { maxTokens: 700, reasoning: "low" });
  if (!answer?.trim() || inventsAmounts(answer, brief) || misattributesAmounts(answer, medicinesInBrief(brief))) {
    return { content: appendLimitNote(rules), source: "rules" };
  }
  return { content: appendLimitNote(answer.trim()), source: "ai" };
}
