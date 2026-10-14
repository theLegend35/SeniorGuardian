import { explainPhrase } from "@/lib/ai/glossary";
import { safetyResponse } from "@/lib/ai/safety";
import type { AssistantAnswer, PatientContext } from "@/lib/ai/types";
import { reminderBlockReason } from "@/lib/medications/schedule";
import { formatWhen, formatTime } from "@/lib/time";
import type { ProposedAction } from "@/types/domain";

function say(content: string, extra: Partial<AssistantAnswer> = {}): AssistantAnswer {
  return { content, proposedAction: null, blocked: false, medicationIds: [], source: "rules", ...extra };
}

export function activeMeds(context: PatientContext) {
  return context.medications.filter((med) => med.status === "active");
}

export function matchingMeds(question: string, context: PatientContext) {
  const haystack = question.toLowerCase();
  const meds = activeMeds(context);
  const named = meds.filter((med) => {
    const name = med.name.toLowerCase();
    if (haystack.includes(name)) return true;
    const head = name.split(" ")[0] ?? "";
    return head.length > 3 && new RegExp(`\\b${head}\\b`, "i").test(question);
  });
  if (named.length > 0) return named;
  if (/\b(my )?(medication|medicine|prescription|pill)s?\b/i.test(question) && meds.length === 1) {
    return meds;
  }
  return [];
}

export function parseTime(question: string): string | null {
  const clock = question.match(/\b([01]?\d|2[0-3]):([0-5]\d)\s*(a\.?m\.?|p\.?m\.?)?/i);
  if (clock) {
    let hour = Number(clock[1]);
    const minute = clock[2];
    const suffix = clock[3]?.toLowerCase().replace(/\./g, "");
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }
  const hourOnly = question.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)/i);
  if (!hourOnly) return null;
  let hour = Number(hourOnly[1]);
  const suffix = hourOnly[2].toLowerCase().replace(/\./g, "");
  if (hour > 12 || hour === 0) return null;
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:00`;
}

function labelQuote(med: { name: string; instructions: string }): string {
  return `${med.name}. The label says: “${med.instructions}”`;
}

function describeMedication(med: PatientContext["medications"][number]): string {
  const when = med.times.length ? ` A reminder is set for ${med.times.map(formatTime).join(" and ")}.` : "";
  const who = med.prescribingProvider ? ` ${med.prescribingProvider} is the prescriber on the label.` : "";
  return `${labelQuote(med)}${when}${who}`;
}

function forMorning(med: PatientContext["medications"][number]): boolean {
  if (/\bmorning\b|\bbreakfast\b/i.test(`${med.instructions} ${med.frequency}`)) return true;
  return med.times.some((time) => time < "12:00");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function morningReply(list: PatientContext["medications"]): string {
  const morning = list.filter(forMorning);
  const later = list.filter((med) => !forMorning(med));
  const words = ["", "one", "two", "three", "four", "five", "six"];
  const count = words[morning.length] ?? String(morning.length);
  const noun = morning.length === 1 ? "morning medicine" : "morning medicines";
  const lead = morning.length
    ? `You have ${count} ${noun}: ${joinNames(morning.map((med) => med.name))}.`
    : "None of your saved labels are for the morning.";
  return [
    lead,
    ...morning.map(labelQuote),
    ...later.map((med) => `${med.name} is for later in the day, not the morning. The label says: “${med.instructions}”`),
  ].join("\n\n");
}

function reminderAction(question: string, context: PatientContext): AssistantAnswer | null {
  if (!/\bremind/i.test(question)) return null;
  const meds = matchingMeds(question, context);
  const time = parseTime(question);
  if (meds.length !== 1 || !time) {
    const names = activeMeds(context).map((med) => med.name).join(", ");
    return say(
      `I can set a reminder once I know which saved medicine and what time you mean. I won’t choose a dose. Your saved medicines are: ${names || "none yet"}. For example: “Remind me to take [medicine name] at 8 PM.” I won’t add more reminders than your label’s doses per day.`,
    );
  }
  const med = meds[0];
  const blockedReason = reminderBlockReason(med, time);
  if (blockedReason) return say(blockedReason, { blocked: true, medicationIds: [med.id] });
  const action: ProposedAction = {
    type: "set_reminder",
    medicationId: med.id,
    medicationName: med.name,
    time,
    preservedInstructions: med.instructions,
  };
  return say(
    `I can add a reminder at ${formatTime(time)} for ${med.name}. This only adds a reminder — it does not change how much you take. Please check the details and confirm.`,
    { proposedAction: action, medicationIds: [med.id] },
  );
}

function noteAction(question: string): AssistantAnswer | null {
  const match = question.match(/^(?:please\s+)?(?:add|save|write)\s+(?:a\s+)?note(?:\s+(?:for|to)\s+my\s+(?:record|timeline))?:?\s*(.+)$/i);
  if (!match?.[1]?.trim()) return null;
  return say("I can add this note to your health timeline, in your own words, after you confirm.", {
    proposedAction: { type: "add_note", body: match[1].trim() },
  });
}

export function answerFromRecord(question: string, context: PatientContext): AssistantAnswer {
  const trimmed = question.trim();
  if (!trimmed) return say("Type or speak a question about your saved health information.");

  const blocked = safetyResponse(trimmed);
  if (blocked) return say(blocked, { blocked: true, source: "safety" });

  const reminder = reminderAction(trimmed, context);
  if (reminder) return reminder;

  const note = noteAction(trimmed);
  if (note) return note;

  if (/\ballerg/i.test(trimmed)) {
    return say(
      context.allergies
        ? `Your record lists this allergy: ${context.allergies}. Make sure every clinician and pharmacist knows about it.`
        : "No allergies are saved in your record yet. You can add them on the My health page. I won’t guess.",
    );
  }

  const meds = matchingMeds(trimmed, context);
  if (meds.length > 0 || /\b(medication|medicine|prescription|pill|dose|take)\b/i.test(trimmed)) {
    const list = meds.length > 0 ? meds : activeMeds(context);
    if (list.length === 0) return say("You don’t have a medicine saved yet. I won’t guess one.");
    const content = /\bmorning\b|\bbreakfast\b/i.test(trimmed) ? morningReply(list) : list.map(describeMedication).join("\n\n");
    return say(content, { medicationIds: list.map((med) => med.id) });
  }

  if (/\b(appointment|visit|doctor|ask)\b/i.test(trimmed)) {
    const upcoming = context.appointments.filter((item) => item.status === "scheduled");
    if (upcoming.length === 0) return say("You don’t have an upcoming appointment saved.");
    const lines = upcoming.map((item) => {
      const questions = item.questions.length ? item.questions.map((q) => `• ${q}`).join("\n") : "• No questions saved yet.";
      return `${item.provider} (${item.specialty}) — ${formatWhen(item.startsAt)}, ${item.location}.\nQuestions you saved:\n${questions}`;
    });
    const fromConcerns = context.concerns.slice(0, 2).map((concern) => `• “${concern.description.slice(0, 120)}”`);
    return say(
      `${lines.join("\n\n")}${fromConcerns.length ? `\n\nYou could also bring up these concerns you saved:\n${fromConcerns.join("\n")}` : ""}`,
    );
  }

  const phrases = explainPhrase(trimmed);
  if (phrases.length > 0) {
    return say(`${phrases.join("\n")}\n\nIf this wording is on a prescription, follow the label and ask your clinician or pharmacist before changing anything.`);
  }

  return say(
    `I can help with what is saved for ${context.patientName}: medicines, appointments, notes, and health concerns. I can’t diagnose or write a prescription. Try “When do I take metformin?” or “What should I ask at my next visit?”`,
  );
}

export const ASSISTANT_SYSTEM = `You are the assistant in Senior Guardian, talking with an older adult about their own saved health record. Sound like a kind person sitting with them: warm, calm, and plain. Not like a form, a disclaimer, or a checklist.

How to answer:
- Answer the question in the first sentence. Then give the detail they need.
- Short sentences. Everyday words.
- When a medicine is part of the answer, quote the saved label exactly once, in quotation marks. You may say morning, with a meal, or bedtime only when the label or a saved reminder time already says that.
- Do not open with "The labels saved on your record say." The label is already on the screen.
- Do not close with "I cannot change a dose" or "I can explain the saved wording." Keep those limits quietly. Mention a dose change only when they ask you to change one.
- If they say hello, greet them and invite one simple question.

Limits, always:
- Use only the facts in the patient record. If something is missing, say so in one sentence.
- Never invent, round, or change a dose, strength, or schedule. Never tell them to start, stop, skip, or change a medicine.
- When you talk about a saved medicine, include its id in medicationIds. Do not restate an amount differently from the label.
- Never diagnose. You are not a doctor, nurse, or pharmacist.
- If they describe chest pain, trouble breathing, stroke signs, severe bleeding, or fainting, tell them to call 911 right away.
- Under 130 words. No headings or tables. Bullets with "• " are fine when you list more than two items.
- Saved reminder times ring on their own. If they ask which alarms are set, use the times already on their medicines. Do not invent a time.

Actions: only propose an action when the person clearly asks for it.
- set_reminder: they ask to be reminded about a saved medicine at a specific time. Use the medicine id and a 24-hour time "HH:MM".
- add_appointment: they give a clinician name and a date and time. Use startsAt in local time "YYYY-MM-DDTHH:MM".
- add_note: they ask you to save a note. Put their words in note.
Otherwise use type "none" and empty strings. The person must confirm every action in the app before anything is saved, so say what you will add and ask them to confirm.`;
