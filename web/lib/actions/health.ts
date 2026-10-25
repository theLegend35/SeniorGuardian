"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { actionError, type ActionState, type LabelState } from "@/lib/actions/state";
import { reviewDocumentAnomalies } from "@/lib/ai/anomalies";
import { withProfileAi } from "@/lib/ai/settings";
import {
  analyzeConcern,
  assistantReply,
  explainText,
  readDocumentImage,
  readPrescriptionLabel,
} from "@/lib/ai/service";
import { extractPdfText } from "@/lib/documents/pdf-text";
import type { ImageInput } from "@/lib/ai/provider";
import type { PatientContext } from "@/lib/ai/types";
import { ValidationError } from "@/lib/auth/access";
import { requireActor, requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import type { PatientChart, PermissionFlags } from "@/lib/data/types";
import { isSampleEmail } from "@/lib/demo/ids";
import { cloudProvider, isCloudProvider } from "@/lib/devices/catalog";
import { syncStoredDevice } from "@/lib/devices/pull";
import { isMetric } from "@/lib/devices/metrics";
import type { Actor, DocumentKind, FileBucket } from "@/types/domain";

const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain"];

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
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

async function uploadFrom(actor: Actor, file: FormDataEntryValue | null, bucket: FileBucket): Promise<{ id: string; image: ImageInput | null; name: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!actor.patientId) throw new ValidationError("A patient record is required.");
  const mimeType = file.type || "application/octet-stream";
  if (!UPLOAD_TYPES.includes(mimeType)) throw new ValidationError("Upload a JPG, PNG, or WebP photo, a PDF, or a text file.");
  const data = Buffer.from(await file.arrayBuffer());
  const saved = await (await getStore()).saveUpload(actor, { patientId: actor.patientId, bucket, fileName: file.name, mimeType, data });
  return { id: saved.id, image: mimeType.startsWith("image/") ? { mimeType, data } : null, name: file.name };
}

// ---------- Medicines ----------

export async function readLabelAction(_state: LabelState, formData: FormData): Promise<LabelState> {
  try {
    const actor = await requireRole("patient");
    const upload = await uploadFrom(actor, formData.get("label"), "prescriptions");
    if (!upload) return { error: "Choose a photo of the prescription label." };
    if (!upload.image) return { error: "Use a photo (JPG, PNG, or WebP) so the label can be read." };
    const reading = await withProfileAi(actor.profileId, () => readPrescriptionLabel(upload.image!));
    return {
      reading,
      fileId: upload.id,
      fileName: upload.name,
      notice: reading
        ? "Label read. Check every word against your bottle before saving."
        : "The photo was saved, but the label could not be read automatically. Please type the details from your label.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveMedicationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target = "";
  try {
    const actor = await requireRole("patient");
    const id = text(formData, "id") || undefined;
    const times = formData
      .getAll("times")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const medication = await (await getStore()).saveMedication(
      actor,
      {
        name: text(formData, "name"),
        instructions: text(formData, "instructions"),
        frequency: text(formData, "frequency"),
        times,
        startDate: text(formData, "startDate"),
        endDate: text(formData, "endDate") || null,
        prescribingProvider: text(formData, "prescribingProvider"),
        notes: text(formData, "notes"),
        reminderEnabled: formData.get("reminderEnabled") === "on",
        labelFileId: text(formData, "labelFileId") || null,
      },
      id,
    );
    revalidatePath("/patient", "layout");
    target = `/patient/medications/${medication.id}${id ? "?saved=1" : "?added=1"}`;
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

export async function revisePrescriptionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("doctor");
    const id = text(formData, "id");
    const store = await getStore();
    const current = await store.getMedication(actor, id);
    const times = formData
      .getAll("times")
      .map((value) => String(value).trim())
      .filter(Boolean);
    await store.saveMedication(
      actor,
      {
        name: text(formData, "name"),
        instructions: text(formData, "instructions"),
        frequency: text(formData, "frequency"),
        times,
        startDate: current.medication.startDate,
        endDate: current.medication.endDate,
        prescribingProvider: current.medication.prescribingProvider,
        notes: current.medication.notes,
        reminderEnabled: current.medication.reminderEnabled,
      },
      id,
    );
    revalidatePath("/doctor", "layout");
    revalidatePath("/patient", "layout");
    return { notice: "Prescription saved. The previous wording stays on the timeline. The assistant did not write this change." };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveMedicationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    await (await getStore()).archiveMedication(actor, text(formData, "id"));
    revalidatePath("/patient", "layout");
  } catch (error) {
    return actionError(error);
  }
  redirect("/patient/medications");
}

export async function markTakenAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor();
    await (await getStore()).markTaken(actor, text(formData, "medicationId"), text(formData, "time"));
    revalidatePath(`/${actor.role}`, "layout");
    return { notice: "Marked as taken." };
  } catch (error) {
    return actionError(error);
  }
}

export async function undoTakenAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor();
    await (await getStore()).undoTaken(actor, text(formData, "medicationId"), text(formData, "time"));
    revalidatePath(`/${actor.role}`, "layout");
    return { notice: "The dose is back to not taken." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addReminderAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor();
    await (await getStore()).setReminder(actor, text(formData, "medicationId"), text(formData, "time"));
    revalidatePath(`/${actor.role}`, "layout");
    return { notice: "Reminder added. The prescription instructions were not changed." };
  } catch (error) {
    return actionError(error);
  }
}

export async function explainMedicationAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const store = await getStore();
    const detail = await store.getMedication(actor, text(formData, "id"));
    if (!detail.prescription) return { error: "There is no saved prescription text for this medicine." };
    const explanation = await withProfileAi(actor.profileId, () => explainText(detail.prescription!.sourceText || detail.medication.instructions, "prescription"));
    await store.savePrescriptionExplanation(actor, detail.prescription.id, explanation.text);
    revalidatePath(`/patient/medications/${detail.medication.id}`);
    return { notice: explanation.source === "ai" ? "Explanation ready. Your original label text was not changed." : "Explanation ready (offline mode). Your original label text was not changed." };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Appointments ----------

export async function saveAppointmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target = "";
  try {
    const actor = await requireRole("patient");
    const id = text(formData, "id") || undefined;
    const date = text(formData, "date");
    const time = text(formData, "time") || "09:00";
    if (!date) return { error: "Choose the date of the appointment." };
    const appointment = await (await getStore()).saveAppointment(
      actor,
      {
        provider: text(formData, "provider"),
        specialty: text(formData, "specialty"),
        startsAt: new Date(`${date}T${time}`).toISOString(),
        location: text(formData, "location"),
        notes: text(formData, "notes"),
        questions: text(formData, "questions")
          .split("\n")
          .map((line) => line.replace(/^[-•*]\s*/, "").trim())
          .filter(Boolean),
        reminderEnabled: formData.get("reminderEnabled") === "on",
      },
      id,
    );
    revalidatePath("/patient", "layout");
    target = `/patient/appointments/${appointment.id}`;
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

export async function addQuestionAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const store = await getStore();
    const appointment = await store.getAppointment(actor, text(formData, "id"));
    const question = text(formData, "question");
    if (!question) return { error: "Type a question first." };
    await store.saveAppointment(
      actor,
      { ...appointment, questions: [...appointment.questions, question] },
      appointment.id,
    );
    revalidatePath(`/patient/appointments/${appointment.id}`);
    return { notice: "Question added to your list." };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveAppointmentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    await (await getStore()).archiveAppointment(actor, text(formData, "id"));
    revalidatePath("/patient", "layout");
  } catch (error) {
    return actionError(error);
  }
  redirect("/patient/appointments");
}

// ---------- Check a Health Concern ----------

export async function saveConcernAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target = "";
  try {
    const actor = await requireRole("patient");
    if (!actor.patientId) return { error: "A patient record is required." };
    const description = text(formData, "description");
    if (description.length < 3) return { error: "Describe what you noticed in a few words." };
    const store = await getStore();
    let upload = await uploadFrom(actor, formData.get("image"), "concerns");
    if (upload && !upload.image) return { error: "Attach a photo (JPG, PNG, or WebP) for a health concern." };
    const analysis = await withProfileAi(actor.profileId, () => analyzeConcern({ description, image: upload?.image ?? null, photoAttached: Boolean(upload) }));
    const concern = await store.createConcern(actor, {
      patientId: actor.patientId,
      description,
      imageFileId: upload?.id ?? null,
      analysis,
      sharedWithCareTeam: formData.get("share") === "on",
    });
    revalidatePath("/patient", "layout");
    target = `/patient/concerns/${concern.id}`;
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

export async function shareConcernAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const share = formData.get("share") === "yes";
    await (await getStore()).setConcernSharing(actor, text(formData, "id"), share);
    revalidatePath("/patient", "layout");
    return { notice: share ? "Shared with your authorized clinicians." : "Sharing turned off. Your care team can no longer see this concern." };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Timeline, health profile, documents ----------

export async function addPatientNoteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    if (!actor.patientId) return { error: "A patient record is required." };
    await (await getStore()).addPatientNote(actor, actor.patientId, text(formData, "body"));
    revalidatePath("/patient/timeline");
    return { notice: "Note added to your timeline." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateHealthAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    await (await getStore()).updateHealthProfile(actor, {
      dateOfBirth: text(formData, "dateOfBirth"),
      address: text(formData, "address"),
      emergencyContact: text(formData, "emergencyContact"),
      bloodType: text(formData, "bloodType"),
      allergies: text(formData, "allergies"),
      conditions: text(formData, "conditions"),
    });
    revalidatePath("/patient", "layout");
    return { notice: "Health information saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function addDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target = "";
  try {
    const actor = await requireRole("patient");
    const upload = await uploadFrom(actor, formData.get("file"), "documents");
    let sourceText = text(formData, "sourceText");
    if (!sourceText && upload?.image) {
      const image = upload.image;
      sourceText = (await withProfileAi(actor.profileId, () => readDocumentImage(image)))?.trim() ?? "";
    }
    if (!upload && !sourceText) return { error: "Choose a file or paste the text from the document." };
    const kind = (["record", "lab", "prescription", "other"].includes(text(formData, "kind")) ? text(formData, "kind") : "other") as DocumentKind;
    const explanation = sourceText ? await withProfileAi(actor.profileId, () => explainText(sourceText, kind === "prescription" ? "prescription" : "document")) : null;
    const document = await (await getStore()).addDocument(actor, {
      title: text(formData, "title") || upload?.name || "Health document",
      kind,
      fileId: upload?.id ?? null,
      sourceText,
      aiExplanation: explanation?.text ?? null,
    });
    revalidatePath("/patient", "layout");
    target = `/patient/health/documents/${document.id}`;
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

const CLINICIAN_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];

export async function addClinicianDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  let target = "";
  try {
    const actor = await requireRole("doctor");
    const store = await getStore();
    const patientId = text(formData, "patientId");
    const cards = await store.listPatientCards(actor);
    if (!cards.some((card) => card.patientId === patientId)) return { error: "That person has not authorized you." };
    const kind = (["record", "lab", "prescription", "other"].includes(text(formData, "kind")) ? text(formData, "kind") : "") as DocumentKind;
    if (!kind) return { error: "Choose a document kind." };
    const file = formData.get("file");
    let upload: { fileName: string; mimeType: string; data: Buffer; image: ImageInput | null } | null = null;
    if (file instanceof File && file.size > 0) {
      const mimeType = file.type || "application/octet-stream";
      if (!CLINICIAN_FILE_TYPES.includes(mimeType)) return { error: "Upload a JPG, PNG, or WebP photo, a PDF, or a text file." };
      if (file.size > 8 * 1024 * 1024) return { error: "Files need to be 8 MB or smaller." };
      const data = Buffer.from(await file.arrayBuffer());
      upload = { fileName: file.name, mimeType, data, image: mimeType.startsWith("image/") ? { mimeType, data } : null };
    }
    let sourceText = text(formData, "sourceText");
    if (!sourceText && upload?.image) {
      const image = upload.image;
      try {
        sourceText = (await withProfileAi(actor.profileId, () => readDocumentImage(image)))?.trim() ?? "";
      } catch {
        sourceText = "";
      }
    }
    if (!sourceText && upload?.mimeType === "application/pdf") sourceText = extractPdfText(upload.data);
    if (!upload && !sourceText) return { error: "Choose a PDF or paste the text from the document." };
    let explanation: string | null = null;
    if (sourceText) {
      try {
        explanation = (await withProfileAi(actor.profileId, () => reviewDocumentAnomalies(sourceText))).text;
      } catch {
        explanation = null;
      }
    } else if (upload) {
      explanation = "The file was saved. It has no selectable text, so nothing was reviewed. Paste the words from the document to check for results it marks high, low, or abnormal.";
    }
    const document = await store.addClinicianDocument(actor, {
      patientId,
      title: text(formData, "title") || upload?.fileName || "Health document",
      kind,
      sourceText,
      aiExplanation: explanation,
      file: upload ? { fileName: upload.fileName, mimeType: upload.mimeType, data: upload.data } : null,
    });
    revalidatePath("/doctor/dashboard");
    revalidatePath(`/doctor/patients/${patientId}`);
    revalidatePath("/patient/health");
    target = `/doctor/patients/${patientId}#documents`;
    void document;
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

export async function explainDocumentAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const store = await getStore();
    const document = await store.getDocument(actor, text(formData, "id"));
    if (!document.sourceText) return { error: "This document has no text to explain." };
    const explanation = await withProfileAi(actor.profileId, () => explainText(document.sourceText, document.kind === "prescription" ? "prescription" : "document"));
    await store.saveDocumentExplanation(actor, document.id, explanation.text);
    revalidatePath(`/patient/health/documents/${document.id}`);
    return { notice: "Explanation updated. The original document was not changed." };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Care team ----------

export async function authorizeDoctorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    await (await getStore()).authorizeDoctor(actor, text(formData, "email"));
    revalidatePath("/patient/care-team");
    return { notice: "Access granted. That clinician can now see your record, and shared concerns only." };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeDoctorAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    await (await getStore()).revokeDoctor(actor, text(formData, "linkId"));
    revalidatePath("/patient/care-team");
    return { notice: "Access removed. That clinician can no longer open your record." };
  } catch (error) {
    return actionError(error);
  }
}

export async function inviteCaregiverAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    await (await getStore()).inviteCaregiver(actor, text(formData, "email"));
    revalidatePath("/patient/care-team");
    return { notice: "Caregiver connected. Nothing is shared until you turn a permission on below." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCaregiverAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const flags: PermissionFlags = {
      viewMedications: formData.get("viewMedications") === "on",
      viewAppointments: formData.get("viewAppointments") === "on",
      viewTimeline: formData.get("viewTimeline") === "on",
      viewConcerns: formData.get("viewConcerns") === "on",
      viewReadings: formData.get("viewReadings") === "on",
      manageReminders: formData.get("manageReminders") === "on",
    };
    const revoke = formData.get("intent") === "revoke";
    await (await getStore()).updateCaregiverAccess(actor, text(formData, "permissionId"), flags, revoke);
    revalidatePath("/patient/care-team");
    return { notice: revoke ? "Caregiver access removed." : "Permissions saved." };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Assistant ----------

export async function askAssistantAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    if (!actor.patientId) return { error: "A patient record is required." };
    const question = text(formData, "question").slice(0, 2000);
    if (!question) return { error: "Type or speak a question first." };
    const store = await getStore();
    const [chart, conversation] = await Promise.all([store.getChart(actor, actor.patientId), store.getConversation(actor)]);
    const history = conversation.messages.map((message) => ({ role: message.role, content: message.content }));
    await store.appendMessage(actor, { role: "user", content: question, proposedAction: null });
    const answer = await withProfileAi(actor.profileId, () => assistantReply(question, contextFrom(actor, chart), history));
    await store.appendMessage(actor, {
      role: "assistant",
      content: answer.content,
      proposedAction: answer.proposedAction,
      medicationIds: answer.medicationIds,
      source: answer.source,
    });
    revalidatePath("/patient/assistant");
    return {};
  } catch (error) {
    return actionError(error);
  }
}

export async function clearAssistantAction(): Promise<void> {
  const actor = await requireRole("patient");
  await (await getStore()).clearConversation(actor);
  revalidatePath("/patient/assistant");
}

export async function resolveAssistantAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    if (!actor.patientId) return { error: "A patient record is required." };
    const store = await getStore();
    const conversation = await store.getConversation(actor);
    const message = conversation.messages.find((item) => item.id === text(formData, "messageId"));
    if (!message?.proposedAction) return { error: "That request is no longer available." };
    if (formData.get("decision") === "dismiss") {
      await store.resolveAction(actor, message.id, "dismissed");
      revalidatePath("/patient/assistant");
      return { notice: "Dismissed. Nothing was changed." };
    }
    const proposal = message.proposedAction;
    if (proposal.type === "set_reminder") {
      const detail = await store.getMedication(actor, proposal.medicationId);
      if (detail.medication.instructions !== proposal.preservedInstructions) {
        return { error: "The saved prescription changed since this was suggested, so nothing was added." };
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
    } else {
      await store.addPatientNote(actor, actor.patientId, proposal.body);
    }
    await store.resolveAction(actor, message.id, "confirmed");
    revalidatePath("/patient", "layout");
    return { notice: "Saved." };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Clinician ----------

export async function addDoctorNoteAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("doctor");
    const patientId = text(formData, "patientId");
    await (await getStore()).addDoctorNote(actor, patientId, text(formData, "body"));
    revalidatePath(`/doctor/patients/${patientId}`);
    return { notice: "Note saved. The patient can see it on their timeline." };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Devices ----------

export async function connectDeviceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const provider = text(formData, "provider");
    if (!isCloudProvider(provider)) return { error: "That device cannot sign in from this website. See which devices can." };
    await (await getStore()).connectDevice(actor, { provider, label: text(formData, "label") });
    revalidatePath("/patient/devices");
    return { notice: `${cloudProvider(provider)!.account} was added. Sign in so the latest numbers can be read onto this record.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function saveRangeAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const metric = text(formData, "metric");
    if (!isMetric(metric)) return { error: "Choose a reading." };
    await (await getStore()).saveReadingRange(actor, {
      metric,
      low: Number(formData.get("low")),
      high: Number(formData.get("high")),
    });
    revalidatePath("/patient/devices");
    return { notice: "Range saved. New readings outside it will notify you and the people allowed to see device readings." };
  } catch (error) {
    return actionError(error);
  }
}

export async function syncDeviceAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireRole("patient");
    const result = await syncStoredDevice(await getStore(), actor, text(formData, "connectionId"));
    revalidatePath("/patient/devices");
    revalidatePath("/patient/notifications");
    if (!result.count) return { error: `${result.account} did not return a reading for the last day. The device may still be syncing, or that metric was not shared.` };
    if (result.alerted) return { notice: `${result.account} is updated. A number is outside a saved range, so a notice was sent.` };
    if (result.outside) return { notice: `${result.account} is updated. A number is outside a saved range. A notice for it was already sent, or the day is not over yet.` };
    return { notice: `${result.account} is updated.` };
  } catch (error) {
    return actionError(error);
  }
}

// ---------- Account ----------

export async function setTextScaleAction(scale: string): Promise<void> {
  const actor = await requireActor();
  if (scale !== "default" && scale !== "large" && scale !== "largest") return;
  await (await getStore()).updateProfile(actor, { textScale: scale });
  revalidatePath("/", "layout");
}

export async function updateSettingsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor();
    const scale = text(formData, "textScale") || "default";
    const locale = text(formData, "locale") === "es" ? "es" : "en";
    if (scale !== "default" && scale !== "large" && scale !== "largest") return { error: "Choose a text size." };
    // Sample accounts are shared, so only the display choices change there.
    const sample = isSampleEmail(actor.email);
    await (await getStore()).updateProfile(
      actor,
      sample
        ? { textScale: scale, locale }
        : {
            fullName: text(formData, "fullName") || actor.fullName,
            phone: text(formData, "phone"),
            textScale: scale,
            locale,
          },
    );
    revalidatePath("/", "layout");
    return { notice: sample ? "Text size and language saved. Sample accounts keep their name and phone." : "Settings saved." };
  } catch (error) {
    return actionError(error);
  }
}

export async function markReadAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  await (await getStore()).markRead(actor, text(formData, "id")).catch(() => undefined);
  revalidatePath(`/${actor.role}`, "layout");
  // Only paths on this site. Browsers drop tabs and newlines, so "/<tab>/other.site" would leave it too.
  const href = text(formData, "href").replace(/[\t\n\r]/g, "");
  if (!href.startsWith("/")) return;
  const target = new URL(href, "https://site.invalid");
  if (target.origin === "https://site.invalid") redirect(`${target.pathname}${target.search}${target.hash}`);
}

export async function markAllReadAction(): Promise<void> {
  const actor = await requireActor();
  await (await getStore()).markAllRead(actor);
  revalidatePath(`/${actor.role}`, "layout");
}

export async function resetDemoAction(): Promise<void> {
  await requireActor();
  await (await getStore()).resetDemo();
  const { signOut } = await import("@/lib/auth/session");
  await signOut();
  redirect("/login?reset=1");
}
