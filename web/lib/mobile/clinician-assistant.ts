import { revalidatePath } from "next/cache";

import { clinicianAssistantReply, type SavedVisit } from "@/lib/ai/clinician";
import { VISION_TYPES, type ImageInput } from "@/lib/ai/provider";
import { aiStatus } from "@/lib/ai/service";
import { withProfileAi } from "@/lib/ai/settings";
import { AccessError, ValidationError } from "@/lib/auth/access";
import { getStore } from "@/lib/data/index";
import { describeSeries, seriesFor } from "@/lib/devices/series";
import { extractPdfText } from "@/lib/documents/pdf-text";
import type { Actor, AiMessage, DeviceMetric } from "@/types/domain";

const METRICS: DeviceMetric[] = ["heart_rate", "sleep_hours", "steps", "blood_oxygen"];
const MAX_FILE = 8 * 1024 * 1024;

export type ClinicianAssistantPayload = {
  messages: AiMessage[];
  patients: Array<{ patientId: string; fullName: string }>;
  suggestions: string[];
  ai: { configured: boolean; label: string };
};

function requireDoctor(actor: Actor) {
  if (actor.role !== "doctor") throw new AccessError("The clinician assistant is for authorized charts.");
}

async function roster(actor: Actor) {
  requireDoctor(actor);
  const store = await getStore();
  const patients = await store.listPatientCards(actor);
  const chunks: string[] = [];
  const visits: SavedVisit[] = [];
  for (const patient of patients) {
    const chart = await store.getChart(actor, patient.patientId);
    const lines = [
      `Patient ${chart.profile.fullName}`,
      `Id ${chart.patient.id}`,
      chart.patient.dateOfBirth ? `Born ${chart.patient.dateOfBirth}` : "",
      chart.patient.conditions ? `Conditions: ${chart.patient.conditions}` : "",
      chart.patient.allergies ? `Allergies: ${chart.patient.allergies}` : "",
      chart.patient.emergencyContact ? `Emergency contact: ${chart.patient.emergencyContact}` : "",
    ];
    for (const visit of chart.appointments ?? []) {
      if (visit.status === "archived") continue;
      lines.push(`Appointment ${visit.provider} ${visit.specialty} ${visit.startsAt} ${visit.location} ${visit.notes}`);
      visits.push({ patientName: chart.profile.fullName, startsAt: visit.startsAt, location: visit.location });
    }
    for (const med of chart.medications ?? []) {
      if (med.status !== "active") continue;
      lines.push(`${med.name}: ${med.instructions}`);
    }
    for (const doc of chart.documents ?? []) lines.push(`Record ${doc.title}\n${doc.sourceText}`);
    const board = await store.getDeviceBoard(actor, patient.patientId);
    for (const metric of METRICS) {
      const points = seriesFor(board.readings, metric);
      if (!points.length) continue;
      lines.push(describeSeries(metric, points, board.ranges.find((item) => item.metric === metric) ?? null));
    }
    chunks.push(lines.filter(Boolean).join("\n"));
  }
  return {
    store,
    patients,
    chart: chunks.join("\n\n"),
    visits,
    refs: patients.map((patient) => ({ id: patient.patientId, name: patient.fullName })),
  };
}

export async function clinicianAssistantSnapshot(actor: Actor): Promise<ClinicianAssistantPayload> {
  requireDoctor(actor);
  const store = await getStore();
  const [thread, patients] = await Promise.all([store.getClinicianThread(actor), store.listPatientCards(actor)]);
  const status = await aiStatus(actor.profileId);
  return {
    messages: thread.messages,
    patients: patients.map((patient) => ({ patientId: patient.patientId, fullName: patient.fullName })),
    suggestions: ["Who has a visit coming up?", "Which device numbers are outside a saved range?", "Draft a follow-up visit"],
    ai: { configured: status.configured, label: status.label },
  };
}

export async function askClinicianAssistant(
  actor: Actor,
  input: { question: string; patientId: string; file: { name: string; mimeType: string; data: Buffer } | null },
): Promise<ClinicianAssistantPayload> {
  const { store, patients, chart, visits, refs } = await roster(actor);
  const question = input.question.trim().slice(0, 2000);
  let attachment = "";
  let image: ImageInput | null = null;
  if (input.file) {
    if (input.file.data.length > MAX_FILE) throw new ValidationError("That file is too large. Use a photo, PDF, or text file under 8 MB.");
    if (!patients.some((patient) => patient.patientId === input.patientId)) throw new ValidationError("Choose the patient this file belongs to.");
    const mime = input.file.mimeType || "application/octet-stream";
    let sourceText = "";
    if (mime === "application/pdf") sourceText = extractPdfText(input.file.data).slice(0, 12000);
    else if (mime.startsWith("text/")) sourceText = input.file.data.toString("utf8").slice(0, 12000);
    else if (VISION_TYPES.has(mime)) {
      sourceText = `Photo attached: ${input.file.name}. The original image is saved on the record.`;
      image = { mimeType: mime, data: input.file.data };
    } else throw new ValidationError("Attach a photo, PDF, or text file.");
    if (!sourceText.trim() && mime === "application/pdf") {
      sourceText = `PDF attached: ${input.file.name}. The original file is saved. Its text could not be read automatically.`;
    }
    const saved = await store.addClinicianDocument(actor, {
      patientId: input.patientId,
      title: input.file.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Attached file",
      kind: "other",
      sourceText,
      aiExplanation: null,
      file: { fileName: input.file.name, mimeType: mime, data: input.file.data },
    });
    attachment = `\n\nAttached file saved on the record as “${saved.title}”:\n${sourceText}`;
  }
  const asked = `${question}${attachment}`.trim();
  if (!asked) throw new ValidationError("Type or speak a question, or attach a file.");
  const thread = await store.getClinicianThread(actor);
  const history = thread.messages.map((message) => ({ role: message.role, content: message.content }));
  await store.appendClinicianMessage(actor, { role: "user", content: asked, proposedAction: null });
  const answer = await withProfileAi(actor.profileId, () => clinicianAssistantReply({ question: asked, chart, patients: refs, visits, history, image }));
  await store.appendClinicianMessage(actor, {
    role: "assistant",
    content: answer.text,
    proposedAction: answer.proposedAction,
    source: answer.source,
  });
  revalidatePath("/doctor/assistant");
  revalidatePath("/doctor/records");
  return clinicianAssistantSnapshot(actor);
}

export async function clearClinicianAssistant(actor: Actor): Promise<ClinicianAssistantPayload> {
  requireDoctor(actor);
  await (await getStore()).clearClinicianThread(actor);
  revalidatePath("/doctor/assistant");
  return clinicianAssistantSnapshot(actor);
}

export async function resolveClinicianAssistant(
  actor: Actor,
  messageId: string,
  decision: "confirm" | "dismiss",
): Promise<{ notice: string; payload: ClinicianAssistantPayload }> {
  requireDoctor(actor);
  const store = await getStore();
  const thread = await store.getClinicianThread(actor);
  const message = thread.messages.find((item) => item.id === messageId);
  if (!message?.proposedAction) throw new ValidationError("That request is no longer available.");
  if (decision === "dismiss") {
    await store.resolveClinicianAction(actor, message.id, "dismissed");
    revalidatePath("/doctor/assistant");
    return { notice: "Dismissed. Nothing was changed.", payload: await clinicianAssistantSnapshot(actor) };
  }
  const proposal = message.proposedAction;
  if (proposal.type === "add_appointment" && proposal.patientId) {
    await store.scheduleVisit(actor, proposal.patientId, {
      provider: proposal.provider,
      specialty: proposal.specialty,
      startsAt: proposal.startsAt,
      location: proposal.location,
      notes: "Added from the clinician assistant after confirmation.",
      questions: proposal.questions,
      reminderEnabled: true,
    });
  } else if (proposal.type === "add_note" && proposal.patientId) {
    await store.addDoctorNote(actor, proposal.patientId, proposal.body);
  } else {
    throw new ValidationError("That action is not available. A medicine dose was not changed.");
  }
  await store.resolveClinicianAction(actor, message.id, "confirmed");
  revalidatePath("/doctor", "layout");
  return { notice: "Saved.", payload: await clinicianAssistantSnapshot(actor) };
}
