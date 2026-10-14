import { formatWhen } from "@/lib/time";

export type ActivityFacts = {
  patientName: string;
  concerns: Array<{ description: string; createdAt: string; shared: boolean }>;
  medications: Array<{ name: string; instructions: string; status: string }>;
  appointments: Array<{ provider: string; startsAt: string; status: string }>;
  notes: Array<{ body: string; createdAt: string }>;
};

export type ActivitySummary = { overview: string; points: string[]; followUps: string[] };

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function summarizeActivity(facts: ActivityFacts): ActivitySummary {
  const concerns = facts.concerns.slice(0, 2);
  const meds = facts.medications.filter((item) => item.status === "active").map((item) => item.name);
  const visits = facts.appointments.filter((item) => item.status === "scheduled").slice(0, 2);
  const note = facts.notes[0];

  const overview = `${facts.patientName} has ${count(facts.concerns.length, "saved concern")}, ${count(meds.length, "active medicine")}, and ${count(visits.length, "upcoming visit")} on record. These points are pulled directly from the entries below.`;
  const points = [
    ...concerns.map((item) => `Concern, ${formatWhen(item.createdAt)}: “${clip(item.description, 140)}”`),
    meds.length ? `Active medicines: ${meds.join(", ")}.` : "No active medicines are saved.",
    ...visits.map((item) => `Visit with ${item.provider}, ${formatWhen(item.startsAt)}.`),
    ...(note ? [`Latest note, ${formatWhen(note.createdAt)}: “${clip(note.body, 160)}”`] : []),
  ];
  return { overview, points, followUps: [] };
}
