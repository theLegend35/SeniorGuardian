import { revalidatePath } from "next/cache";

import { aiStatus, assistantReply } from "@/lib/ai/service";
import { withProfileAi } from "@/lib/ai/settings";
import type { PatientContext } from "@/lib/ai/types";
import { AccessError, ValidationError } from "@/lib/auth/access";
import { getStore } from "@/lib/data/index";
import type { PatientChart } from "@/lib/data/types";
import { reminderBlockReason } from "@/lib/medications/schedule";
import type { Actor, AiMessage, Medication } from "@/types/domain";

export type AssistantLabel = { name: string; text: string; prescriber: string };

export type PatientAssistantPayload = {
  messages: AiMessage[];
  labels: Record<string, AssistantLabel>;
  suggestions: string[];
  ai: { configured: boolean; label: string };
  medicines: Array<{ id: string; name: string; times: string[] }>;
};

function requirePatient(actor: Actor): string {
  if (actor.role !== "patient" || !actor.patientId) throw new AccessError("The health assistant is part of the patient record.");
  return actor.patientId;
}

function contextFrom(actor: Actor, chart: PatientChart): PatientContext {
  return {
    patientName: actor.fullName,
    allergies: chart.patient.allergies,
    conditions: chart.patient.conditions,
    medications: (chart.medications ?? []).map((med) => ({
      id: med.id,
      name: med.name,
      instructions: med.instructions,
      frequency: med.frequency,
      times: med.times,
      prescribingProvider: med.prescribingProvider,
      status: med.status,
    })),
    appointments: (chart.appointments ?? [])
      .filter((item) => item.status !== "archived")
      .map((item) => ({
        id: item.id,
        provider: item.provider,
        specialty: item.specialty,
        startsAt: item.startsAt,
        location: item.location,
        questions: item.questions,
        status: item.status,
      })),
    concerns: (chart.concerns ?? []).slice(-5).map((item) => ({
      id: item.id,
      description: item.description,
      createdAt: item.createdAt,
    })),
  };
}

function suggestionsFor(meds: Medication[]): string[] {
  const shortName = (name: string) => name.split(" ")[0]?.toLowerCase() || name.toLowerCase();
  const first = meds[0]?.name;
  const roomForReminder = meds.find((med) => !reminderBlockReason(med, "20:00"));
  return [
    first ? `When do I take my ${shortName(first)}?` : "What medicines do I take today?",
    "When is my next appointment?",
    "What does “twice daily” mean?",
    "Help me write questions for my next visit",
    roomForReminder ? `Remind me to take ${shortName(roomForReminder.name)} at 8 PM` : "What medicines do I take today?",
    "What does my lab report mean?",
  ];
}

export async function patientAssistantSnapshot(actor: Actor): Promise<PatientAssistantPayload> {
  const patientId = requirePatient(actor);
  const store = await getStore();
  const [conversation, chart] = await Promise.all([store.getConversation(actor), store.getChart(actor, patientId)]);
  const labels: Record<string, AssistantLabel> = {};
  for (const med of chart.medications ?? []) {
    const prescription = (chart.prescriptions ?? []).find((item) => item.id === med.prescriptionId);
    labels[med.id] = {
      name: med.name,
      text: prescription?.sourceText || med.instructions,
      prescriber: med.prescribingProvider,
    };
  }
  const active = (chart.medications ?? []).filter((med) => med.status === "active");
  const status = await aiStatus(actor.profileId);
  return {
    messages: conversation.messages,
    labels,
    suggestions: suggestionsFor(active),
    ai: { configured: status.configured, label: status.label },
    medicines: active.map((med) => ({ id: med.id, name: med.name, times: med.times })),
  };
}

export async function askPatientAssistant(actor: Actor, question: string): Promise<PatientAssistantPayload> {
  const patientId = requirePatient(actor);
  const asked = question.trim().slice(0, 2000);
  if (!asked) throw new ValidationError("Type or speak a question first.");
  const store = await getStore();
  const [chart, conversation] = await Promise.all([store.getChart(actor, patientId), store.getConversation(actor)]);
  const history = conversation.messages.map((message) => ({ role: message.role, content: message.content }));
  await store.appendMessage(actor, { role: "user", content: asked, proposedAction: null });
  const answer = await withProfileAi(actor.profileId, () => assistantReply(asked, contextFrom(actor, chart), history));
  await store.appendMessage(actor, {
    role: "assistant",
    content: answer.content,
    proposedAction: answer.proposedAction,
    medicationIds: answer.medicationIds,
    source: answer.source,
  });
  revalidatePath("/patient/assistant");
  return patientAssistantSnapshot(actor);
}

export async function clearPatientAssistant(actor: Actor): Promise<PatientAssistantPayload> {
  requirePatient(actor);
  await (await getStore()).clearConversation(actor);
  revalidatePath("/patient/assistant");
  return patientAssistantSnapshot(actor);
}

export async function resolvePatientAssistant(actor: Actor, messageId: string, decision: "confirm" | "dismiss"): Promise<{ notice: string; payload: PatientAssistantPayload }> {
  const patientId = requirePatient(actor);
  const store = await getStore();
  const conversation = await store.getConversation(actor);
  const message = conversation.messages.find((item) => item.id === messageId);
  if (!message?.proposedAction) throw new ValidationError("That request is no longer available.");
  if (decision === "dismiss") {
    await store.resolveAction(actor, message.id, "dismissed");
    revalidatePath("/patient/assistant");
    return { notice: "Dismissed. Nothing was changed.", payload: await patientAssistantSnapshot(actor) };
  }
  const proposal = message.proposedAction;
  if (proposal.type === "set_reminder") {
    const detail = await store.getMedication(actor, proposal.medicationId);
    if (detail.medication.instructions !== proposal.preservedInstructions) {
      throw new ValidationError("The saved prescription changed since this was suggested, so nothing was added.");
    }
    await store.setReminder(actor, proposal.medicationId, proposal.time);
  } else if (proposal.type === "add_appointment") {
    await store.saveAppointment(actor, {
      provider: proposal.provider,
      specialty: proposal.specialty,
      startsAt: proposal.startsAt,
      location: proposal.location,
      notes: "Added from the assistant after you confirmed.",
      questions: proposal.questions,
      reminderEnabled: true,
    });
  } else if (proposal.type === "add_note") {
    await store.addPatientNote(actor, patientId, proposal.body);
  } else {
    throw new ValidationError("That action is not available. A medicine dose was not changed.");
  }
  await store.resolveAction(actor, message.id, "confirmed");
  revalidatePath("/patient", "layout");
  return { notice: "Saved.", payload: await patientAssistantSnapshot(actor) };
}
