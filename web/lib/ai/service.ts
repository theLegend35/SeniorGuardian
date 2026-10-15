import { z } from "zod";

import { answerFromRecord, ASSISTANT_SYSTEM } from "@/lib/ai/chat";
import { explainSourceText } from "@/lib/ai/documents";
import { aiConfig, appendLimitNote, generateObject, generateText, imagePart, type ChatMessage, type ImageInput } from "@/lib/ai/provider";
import { readAiChoice } from "@/lib/ai/settings";
import { safetyResponse } from "@/lib/ai/safety";
import { reminderBlockReason } from "@/lib/medications/schedule";
import type { AssistantAnswer, HistoryTurn, LabelReading, PatientContext } from "@/lib/ai/types";
import { analyzeConcernLocal, STANDARD_WARNING_SIGNS, urgencyFromText } from "@/lib/ai/vision";
import { APP_TIME_ZONE, localDate } from "@/lib/time";
import type { ConcernAnalysis, ProposedAction } from "@/types/domain";

const AMOUNT = /(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|ml|units?|iu|tablets?|capsules?|pills?|puffs?|drops?)\b/gi;

/** Every amount the model writes must already appear in the source text it was given. */
export function inventsAmounts(output: string, source: string): boolean {
  const known = source.toLowerCase().replace(/,/g, "");
  for (const match of output.matchAll(AMOUNT)) {
    const number = match[1].replace(/,/g, "");
    if (!new RegExp(`(^|[^\\d.])${number.replace(".", "\\.")}([^\\d]|$)`).test(known)) return true;
  }
  return false;
}

export async function aiStatus(profileId: string) {
  const view = await readAiChoice(profileId);
  return {
    configured: view.configured,
    label: view.configured ? `${view.activeLabel} · ${view.activeModel}` : view.activeLabel,
    model: view.activeModel,
  };
}

const AssistantSchema = z.object({
  reply: z.string(),
  medicationIds: z.array(z.string()),
  action: z.object({
    type: z.enum(["none", "set_reminder", "add_appointment", "add_note"]),
    medicationId: z.string(),
    time: z.string(),
    provider: z.string(),
    specialty: z.string(),
    startsAt: z.string(),
    location: z.string(),
    note: z.string(),
  }),
});

function validatedAction(action: z.infer<typeof AssistantSchema>["action"], context: PatientContext): ProposedAction | null {
  if (action.type === "set_reminder") {
    const med = context.medications.find((item) => item.id === action.medicationId && item.status === "active");
    if (!med || !/^([01]\d|2[0-3]):[0-5]\d$/.test(action.time) || reminderBlockReason(med, action.time)) return null;
    return { type: "set_reminder", medicationId: med.id, medicationName: med.name, time: action.time, preservedInstructions: med.instructions };
  }
  if (action.type === "add_appointment") {
    const starts = new Date(action.startsAt);
    if (!action.provider.trim() || Number.isNaN(starts.getTime()) || starts.getTime() < Date.now() - 60_000) return null;
    return {
      type: "add_appointment",
      provider: action.provider.trim().slice(0, 160),
      specialty: action.specialty.trim().slice(0, 120),
      startsAt: starts.toISOString(),
      location: action.location.trim().slice(0, 200),
      questions: [],
    };
  }
  if (action.type === "add_note" && action.note.trim()) {
    return { type: "add_note", body: action.note.trim().slice(0, 2000) };
  }
  return null;
}

export async function assistantReply(question: string, context: PatientContext, history: HistoryTurn[] = []): Promise<AssistantAnswer> {
  const local = answerFromRecord(question, context);
  if (local.blocked || !aiConfig().configured) return local;

  const now = new Date();
  const record = {
    today: `${localDate(now)} ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE })}`,
    ...context,
  };
  const messages: ChatMessage[] = [
    { role: "system", content: ASSISTANT_SYSTEM },
    { role: "system", content: `Patient record (the only facts you may use):\n${JSON.stringify(record)}` },
    ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }) as ChatMessage),
    { role: "user", content: question },
  ];
  const result = await generateObject(messages, AssistantSchema, "assistant_reply", { maxTokens: 2048 });
  if (!result?.reply.trim()) return { ...local, content: appendLimitNote(local.content) };

  const source = JSON.stringify(context);
  if (inventsAmounts(result.reply, source)) return { ...local, content: appendLimitNote(local.content) };

  if (result.action.type === "set_reminder") {
    const med = context.medications.find((item) => item.id === result.action.medicationId);
    const reason = med && reminderBlockReason(med, result.action.time);
    if (med && reason) return { content: appendLimitNote(reason), proposedAction: null, blocked: true, medicationIds: [med.id], source: "rules" };
  }

  const known = new Set(context.medications.map((med) => med.id));
  return {
    content: appendLimitNote(result.reply.trim()),
    proposedAction: validatedAction(result.action, context),
    blocked: false,
    medicationIds: result.medicationIds.filter((id) => known.has(id)),
    source: "ai",
  };
}

const ConcernSchema = z.object({
  summary: z.string(),
  observations: z.array(z.string()),
  possibilities: z.array(z.string()),
  warningSigns: z.array(z.string()),
  usefulInformation: z.array(z.string()),
  whenToSeekCare: z.string(),
  urgency: z.enum(["emergency", "prompt", "routine", "unclear"]),
  uncertainty: z.string(),
  insufficient: z.boolean(),
  imageUsable: z.boolean(),
});

const CONCERN_SYSTEM = `You help an older adult describe a health concern clearly so their own clinician can review it. You are not a doctor and you never diagnose.

- observations: describe only what is visible in the photo (location, color, size compared with nearby features, texture) and restate what the person wrote. Never claim certainty.
- possibilities: 2 to 4 general categories a clinician might consider, written with "could" or "might". Never present one as the answer. Leave empty if there is too little information.
- warningSigns: 3 to 5 specific signs that would mean they should get care quickly.
- usefulInformation: 3 to 4 details their clinician would want to know.
- urgency: "emergency" for possible emergency signs, "prompt" if they should contact a clinician within a day, "routine" otherwise, "unclear" if you cannot tell.
- If the photo is blurry, unrelated, or missing and the description is thin, set insufficient to true and explain what is missing. Set imageUsable to false if no usable photo was provided.
- Never mention specific medicines or doses.
- Plain language for an older reader. Each list item under 22 words. summary under 45 words.`;

export async function analyzeConcern(input: { description: string; image: ImageInput | null; photoAttached?: boolean }): Promise<ConcernAnalysis> {
  const local = analyzeConcernLocal({ description: input.description, hasImage: Boolean(input.image) || Boolean(input.photoAttached) });
  if (local.urgency === "emergency" || !aiConfig().configured) return local;

  const photo = input.image ? imagePart(input.image) : null;
  const photoNote = photo
    ? "A photo is attached."
    : input.photoAttached
      ? "A photo was saved for the clinician but is not available to you. Review the description only and do not describe the photo."
      : "No photo is attached.";
  const result = await generateObject(
    [
      { role: "system", content: CONCERN_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `What the person wrote:\n"""${input.description}"""\n${photoNote}` },
          ...(photo ? [photo] : []),
        ],
      },
    ],
    ConcernSchema,
    "health_concern_review",
  );
  if (!result) return { ...local, uncertainty: appendLimitNote(local.uncertainty) };

  const ruleUrgency = urgencyFromText(input.description);
  const urgency = ruleUrgency === "prompt" && result.urgency === "routine" ? "prompt" : result.urgency;
  return {
    summary: result.summary,
    observations: result.observations.length ? result.observations : local.observations,
    possibilities: result.possibilities,
    warningSigns: result.warningSigns.length ? result.warningSigns : STANDARD_WARNING_SIGNS,
    usefulInformation: result.usefulInformation,
    whenToSeekCare: result.whenToSeekCare,
    urgency,
    uncertainty: appendLimitNote(result.uncertainty || local.uncertainty),
    insufficient: result.insufficient,
    imageReviewed: Boolean(photo) && result.imageUsable,
    source: "ai",
    model: aiConfig().model,
  };
}

const EXPLAIN_SYSTEM = `You explain prescription labels and medical documents to an older adult in plain language.
- The original text is the source of truth. Never change, round, or add a dose, strength, or schedule. If you mention an amount, copy it exactly.
- Never tell them to start, stop, or change a medicine. Never diagnose.
- Explain abbreviations, timing, and medical words. For results marked high or low, say what the test measures and that their clinician will interpret it.
- Format as short sections separated by blank lines. Each section starts with a short title line ("What this means", "Words explained", "Questions to ask"). Use "• " bullets. No markdown symbols like # or **.
- Under 180 words.`;

export async function explainText(sourceText: string, kind: "prescription" | "document" = "prescription"): Promise<{ text: string; source: "ai" | "rules" }> {
  const local = explainSourceText(sourceText, kind);
  if (!sourceText.trim() || !aiConfig().configured) return { text: local, source: "rules" };
  const result = await generateText([
    { role: "system", content: EXPLAIN_SYSTEM },
    { role: "user", content: `Original ${kind === "prescription" ? "prescription label" : "document"} text:\n"""${sourceText}"""` },
  ]);
  if (!result || inventsAmounts(result, sourceText)) return { text: appendLimitNote(local), source: "rules" };
  return { text: appendLimitNote(result.replace(/\*\*|^#+\s*/gm, "")), source: "ai" };
}

const LabelSchema = z.object({
  readable: z.boolean(),
  medicationName: z.string(),
  instructions: z.string(),
  frequency: z.string(),
  prescriber: z.string(),
  pharmacy: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string(),
});

export async function readPrescriptionLabel(image: ImageInput): Promise<LabelReading | null> {
  const photo = imagePart(image);
  if (!photo || !aiConfig().configured) return null;
  const result = await generateObject(
    [
      {
        role: "system",
        content:
          "Transcribe a prescription label photo. Copy text exactly as printed. Do not guess or correct anything. medicationName includes the strength as printed. instructions is the directions line, word for word. frequency is a short plain summary of how often, using only what the label says. Use an empty string for anything you cannot read. notes lists anything unclear.",
      },
      { role: "user", content: [{ type: "text", text: "Read this prescription label." }, photo] },
    ],
    LabelSchema,
    "prescription_label",
    { maxTokens: 1500 },
  );
  if (!result?.readable || !result.medicationName.trim() || !result.instructions.trim()) return null;
  return {
    medicationName: result.medicationName.trim(),
    instructions: result.instructions.trim(),
    frequency: result.frequency.trim(),
    prescriber: result.prescriber.trim(),
    pharmacy: result.pharmacy.trim(),
    confidence: result.confidence,
    notes: result.notes.trim(),
  };
}

export async function readDocumentImage(image: ImageInput): Promise<string | null> {
  const photo = imagePart(image);
  if (!photo || !aiConfig().configured) return null;
  return generateText(
    [
      {
        role: "system",
        content: "Transcribe the text in this medical document photo exactly, line by line. Do not summarize or correct it. If it is unreadable, reply with an empty string.",
      },
      { role: "user", content: [{ type: "text", text: "Transcribe this document." }, photo] },
    ],
    { maxTokens: 3000 },
  );
}

export { safetyResponse };
