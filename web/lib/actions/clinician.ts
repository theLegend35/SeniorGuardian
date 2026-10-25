"use server";

import { revalidatePath } from "next/cache";

import type { MedicineText } from "@/lib/ai/amounts";
import { answerClinician, clinicianAssistantReply, type SavedVisit } from "@/lib/ai/clinician";
import { withProfileAi } from "@/lib/ai/settings";
import { VISION_TYPES } from "@/lib/ai/provider";
import { extractPdfText } from "@/lib/documents/pdf-text";
import { actionError, type ActionState } from "@/lib/actions/state";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { describeSeries, seriesFor } from "@/lib/devices/series";
import type { DeviceMetric } from "@/types/domain";

export type ClinicianAskState = ActionState & { answer?: string };

const METRICS: DeviceMetric[] = ["heart_rate", "sleep_hours", "steps", "blood_oxygen"];

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function askClinicianAction(_state: ClinicianAskState, formData: FormData): Promise<ClinicianAskState> {
  try {
    const actor = await requireRole("doctor");
    const store = await getStore();
    const patients = await store.listPatientCards(actor);
    const documentId = field(formData, "documentId");
    const chunks: string[] = [];
    let focus = "";
    let found = !documentId;
    for (const patient of patients) {
      const chart = await store.getChart(actor, patient.patientId);
      const lines = [`Patient ${chart.profile.fullName}`];
      for (const med of chart.medications ?? []) {
        if (med.status !== "active") continue;
        lines.push(`${med.name}: ${med.instructions}`);
      }
      for (const doc of chart.documents ?? []) {
        lines.push(`${doc.title}\n${doc.sourceText}`);
        if (doc.id === documentId) {
          focus = doc.sourceText;
          found = true;
        }
      }
      const board = await store.getDeviceBoard(actor, patient.patientId);
      for (const metric of METRICS) {
        const points = seriesFor(board.readings, metric);
        if (!points.length) continue;
        lines.push(describeSeries(metric, points, board.ranges.find((item) => item.metric === metric) ?? null));
      }
      chunks.push(lines.join("\n"));
    }
    if (!found) return { error: "That record is not on a chart you can see." };
    const result = await withProfileAi(actor.profileId, () => answerClinician(field(formData, "question"), chunks.join("\n\n"), focus));
    return { answer: result.text };
  } catch (error) {
    return actionError(error);
  }
}

export async function askClinicianChatAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("doctor");
    const store = await getStore();
    const patients = await store.listPatientCards(actor);
    const patientId = field(formData, "patientId");
    const question = field(formData, "question").slice(0, 2000);
    const upload = formData.get("file");
    let attachment = "";
    let image: { mimeType: string; data: Buffer } | null = null;
    if (upload instanceof File && upload.size > 0) {
      if (!patients.some((patient) => patient.patientId === patientId)) return { error: "Choose the patient this file belongs to." };
      const data = Buffer.from(await upload.arrayBuffer());
      const mime = upload.type || "application/octet-stream";
      let sourceText = "";
      if (mime === "application/pdf") sourceText = extractPdfText(data).slice(0, 12000);
      else if (mime.startsWith("text/")) sourceText = data.toString("utf8").slice(0, 12000);
      else if (VISION_TYPES.has(mime)) {
        sourceText = `Photo attached: ${upload.name}. The original image is saved on the record.`;
        image = { mimeType: mime, data };
      } else return { error: "Attach a photo, PDF, or text file." };
      if (!sourceText.trim() && mime === "application/pdf") sourceText = `PDF attached: ${upload.name}. The original file is saved. Its text could not be read automatically.`;
      const saved = await store.addClinicianDocument(actor, {
        patientId,
        title: upload.name.replace(/\.[^.]+$/, "").slice(0, 160) || "Attached file",
        kind: "other",
        sourceText,
        aiExplanation: null,
        file: { fileName: upload.name, mimeType: mime, data },
      });
      attachment = `\n\nAttached file saved on the record as “${saved.title}”:\n${sourceText}`;
    }
    const asked = `${question}${attachment}`.trim();
    if (!asked) return { error: "Type or speak a question, or attach a file." };
    const chunks: string[] = [];
    const visits: SavedVisit[] = [];
    const medicines: MedicineText[] = [];
    const roster = patients.map((patient) => ({ id: patient.patientId, name: patient.fullName }));
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
        medicines.push({ id: med.id, name: med.name, text: `${med.instructions}\n${med.frequency}` });
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
    const thread = await store.getClinicianThread(actor);
    const history = thread.messages.map((message) => ({ role: message.role, content: message.content }));
    await store.appendClinicianMessage(actor, { role: "user", content: asked, proposedAction: null });
    const answer = await withProfileAi(actor.profileId, () =>
      clinicianAssistantReply({
        question: asked,
        chart: chunks.join("\n\n"),
        patients: roster,
        visits,
        history,
        image,
        medicines,
      }),
    );
    await store.appendClinicianMessage(actor, {
      role: "assistant",
      content: answer.text,
      proposedAction: answer.proposedAction,
      source: answer.source,
    });
    revalidatePath("/doctor/assistant");
    revalidatePath("/doctor/records");
    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function clearClinicianChatAction(): Promise<void> {
  const actor = await requireRole("doctor");
  await (await getStore()).clearClinicianThread(actor);
  revalidatePath("/doctor/assistant");
}

export async function resolveClinicianChatAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("doctor");
    const store = await getStore();
    const thread = await store.getClinicianThread(actor);
    const message = thread.messages.find((item) => item.id === field(formData, "messageId"));
    if (!message?.proposedAction) return { error: "That request is no longer available." };
    if (formData.get("decision") === "dismiss") {
      await store.resolveClinicianAction(actor, message.id, "dismissed");
      revalidatePath("/doctor/assistant");
      return { notice: "Dismissed. Nothing was changed." };
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
      return { error: "That action is not available. A medicine dose was not changed." };
    }
    await store.resolveClinicianAction(actor, message.id, "confirmed");
    revalidatePath("/doctor", "layout");
    return { notice: "Saved." };
  } catch (error) {
    return actionError(error);
  }
}
