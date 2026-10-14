import { reminderBlockReason } from "@/lib/dose-limit";
import { ageFrom, isTime, localDate, parseWhen } from "@/lib/format";
import { supabase, supabaseReady, webUrl } from "@/lib/supabase";
import type {
  Access,
  Actor,
  ChatMessage,
  Concern,
  Connection,
  DocumentRow,
  Dose,
  HealthProfile,
  Medicine,
  Notice,
  PersonBundle,
  PersonCard,
  Reading,
  Role,
  TextScale,
  TimelineItem,
  Visit,
} from "@/lib/types";
import { DOCTOR_ACCESS } from "@/lib/types";

type Row = Record<string, unknown>;

const METRIC_LABELS: Record<string, string> = {
  heart_rate: "Heart rate",
  sleep_hours: "Sleep",
  steps: "Steps",
  blood_oxygen: "Blood oxygen",
};

function text(row: Row, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value);
}

function plainNumber(value: string): string {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : value;
}

function raise(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

function ensureReady() {
  if (!supabaseReady) throw new Error("This app needs the same Supabase project as the website. Add the public keys to mobile/.env.");
}

function uuid(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && "randomUUID" in cryptoRef) return cryptoRef.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/[x]/g, () => Math.floor(Math.random() * 16).toString(16));
}

function medicineFrom(row: Row): Medicine {
  const times = Array.isArray(row.times) ? row.times.map(String) : [];
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    name: text(row, "name"),
    instructions: text(row, "instructions"),
    frequency: text(row, "frequency"),
    times,
    status: text(row, "status"),
    reminderEnabled: Boolean(row.reminder_enabled),
    prescribingProvider: text(row, "prescribing_provider"),
    notes: text(row, "notes"),
  };
}

function visitFrom(row: Row): Visit {
  const questions = Array.isArray(row.questions) ? row.questions.map(String) : [];
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    provider: text(row, "provider"),
    specialty: text(row, "specialty"),
    startsAt: text(row, "starts_at"),
    location: text(row, "location"),
    notes: text(row, "notes"),
    questions,
    reminderEnabled: Boolean(row.reminder_enabled),
    status: text(row, "status"),
  };
}

function accessFrom(row: Row, notes: boolean): Access {
  return {
    medications: Boolean(row.view_medications),
    appointments: Boolean(row.view_appointments),
    timeline: Boolean(row.view_timeline),
    concerns: Boolean(row.view_concerns),
    readings: Boolean(row.view_readings),
    reminders: Boolean(row.manage_reminders),
    notes,
  };
}

export async function loadActor(profileId: string): Promise<Actor | null> {
  ensureReady();
  const { data, error } = await supabase.from("profiles").select("id, email, role, full_name, phone, text_scale").eq("id", profileId).maybeSingle();
  raise(error, "The account could not be opened.");
  if (!data) return null;
  const row = data as Row;
  const role = text(row, "role") as Role;
  const [patient, doctor, caregiver] = await Promise.all([
    supabase.from("patients").select("id").eq("profile_id", profileId).maybeSingle(),
    supabase.from("doctors").select("id, specialty, clinic").eq("profile_id", profileId).maybeSingle(),
    supabase.from("caregivers").select("id, relationship").eq("profile_id", profileId).maybeSingle(),
  ]);
  raise(patient.error, "The account could not be opened.");
  raise(doctor.error, "The account could not be opened.");
  raise(caregiver.error, "The account could not be opened.");
  const scale = text(row, "text_scale");
  return {
    profileId,
    role,
    email: text(row, "email"),
    fullName: text(row, "full_name"),
    phone: text(row, "phone"),
    textScale: scale === "large" || scale === "largest" ? scale : "default",
    patientId: patient.data ? text(patient.data as Row, "id") : null,
    doctorId: doctor.data ? text(doctor.data as Row, "id") : null,
    caregiverId: caregiver.data ? text(caregiver.data as Row, "id") : null,
    specialty: doctor.data ? text(doctor.data as Row, "specialty") : "",
    clinic: doctor.data ? text(doctor.data as Row, "clinic") : "",
    relationship: caregiver.data ? text(caregiver.data as Row, "relationship") : "",
  };
}

async function namesFor(patientIds: string[]): Promise<Map<string, { name: string; detail: string }>> {
  const map = new Map<string, { name: string; detail: string }>();
  if (!patientIds.length) return map;
  const patients = await supabase.from("patients").select("id, profile_id, date_of_birth, conditions").in("id", patientIds);
  raise(patients.error, "The people list could not be opened.");
  const rows = (patients.data ?? []) as Row[];
  const profileIds = rows.map((row) => text(row, "profile_id")).filter(Boolean);
  const profiles = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [], error: null };
  raise(profiles.error, "The people list could not be opened.");
  const profileName = new Map(((profiles.data ?? []) as Row[]).map((row) => [text(row, "id"), text(row, "full_name")]));
  for (const row of rows) {
    const age = ageFrom(text(row, "date_of_birth"));
    const conditions = text(row, "conditions");
    map.set(text(row, "id"), {
      name: profileName.get(text(row, "profile_id")) || "Patient",
      detail: [age !== null ? `${age} years old` : "", conditions].filter(Boolean).join(" · "),
    });
  }
  return map;
}

export async function listPeople(actor: Actor): Promise<PersonCard[]> {
  ensureReady();
  if (actor.role === "doctor" && actor.doctorId) {
    const links = await supabase.from("patient_doctors").select("patient_id").eq("doctor_id", actor.doctorId).eq("status", "active");
    raise(links.error, "Patients could not be loaded.");
    const ids = ((links.data ?? []) as Row[]).map((row) => text(row, "patient_id"));
    const names = await namesFor(ids);
    return ids.map((patientId) => ({
      patientId,
      name: names.get(patientId)?.name ?? "Patient",
      detail: names.get(patientId)?.detail ?? "",
      access: DOCTOR_ACCESS,
    }));
  }
  if (actor.role === "caregiver" && actor.caregiverId) {
    const grants = await supabase
      .from("caregiver_permissions")
      .select("patient_id, view_medications, view_appointments, view_timeline, view_concerns, view_readings, manage_reminders, status")
      .eq("caregiver_id", actor.caregiverId)
      .eq("status", "active");
    raise(grants.error, "People could not be loaded.");
    const rows = (grants.data ?? []) as Row[];
    const names = await namesFor(rows.map((row) => text(row, "patient_id")));
    return rows.map((row) => {
      const patientId = text(row, "patient_id");
      return {
        patientId,
        name: names.get(patientId)?.name ?? "Patient",
        detail: names.get(patientId)?.detail ?? "",
        access: accessFrom(row, false),
      };
    });
  }
  return [];
}

export async function listMedicines(patientId: string): Promise<Medicine[]> {
  ensureReady();
  const result = await supabase.from("medications").select("*").eq("patient_id", patientId).eq("status", "active").order("name");
  raise(result.error, "Medicines could not be loaded.");
  return ((result.data ?? []) as Row[]).map(medicineFrom);
}

export async function getMedicine(id: string): Promise<Medicine | null> {
  ensureReady();
  const result = await supabase.from("medications").select("*").eq("id", id).maybeSingle();
  raise(result.error, "That medicine could not be opened.");
  return result.data ? medicineFrom(result.data as Row) : null;
}

export async function todayDoses(patientId: string): Promise<Dose[]> {
  const medicines = await listMedicines(patientId);
  const day = localDate();
  const events = await supabase.from("medication_events").select("medication_id, scheduled_for").eq("patient_id", patientId).eq("kind", "taken").like("scheduled_for", `${day}%`);
  raise(events.error, "Today's doses could not be loaded.");
  const taken = new Set(((events.data ?? []) as Row[]).map((row) => `${text(row, "medication_id")}|${text(row, "scheduled_for")}`));
  return medicines
    .flatMap((medicine) =>
      medicine.times.map((time) => {
        const scheduledFor = `${day}T${time}`;
        return { medicine, time, scheduledFor, taken: taken.has(`${medicine.id}|${scheduledFor}`) };
      }),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function markTaken(actor: Actor, medicine: Medicine, time: string): Promise<void> {
  ensureReady();
  if (!isTime(time)) throw new Error("Choose a reminder time.");
  const scheduledFor = `${localDate()}T${time}`;
  const existing = await supabase.from("medication_events").select("id").eq("medication_id", medicine.id).eq("kind", "taken").eq("scheduled_for", scheduledFor).limit(1);
  raise(existing.error, "That dose could not be updated.");
  if (existing.data && existing.data.length > 0) return;
  const own = actor.patientId === medicine.patientId;
  const inserted = await supabase.from("medication_events").insert({
    medication_id: medicine.id,
    patient_id: medicine.patientId,
    kind: "taken",
    scheduled_for: scheduledFor,
    note: own ? "Marked taken by the patient." : `Marked taken by ${actor.fullName} (caregiver).`,
  });
  raise(inserted.error, "That dose could not be saved.");
  const timeline = await supabase.from("health_timeline").insert({
    patient_id: medicine.patientId,
    kind: "medication_activity",
    title: `Taken: ${medicine.name}`,
    summary: `Marked taken for ${time}. Instructions remain: ${medicine.instructions}`,
    source_label: own ? "Recorded by the patient" : `Recorded by ${actor.fullName}, caregiver`,
    ref_table: "medications",
    ref_id: medicine.id,
  });
  raise(timeline.error, "That dose could not be saved.");
}

export async function addReminderTime(actor: Actor, medicine: Medicine, time: string): Promise<void> {
  ensureReady();
  if (!isTime(time)) throw new Error("Use a time like 08:00 or 18:30.");
  const blocked = reminderBlockReason(medicine, time);
  if (blocked) throw new Error(blocked);
  const updated = await supabase
    .from("medications")
    .update({ times: [...medicine.times, time].sort(), reminder_enabled: true })
    .eq("id", medicine.id);
  raise(updated.error, "The reminder could not be saved.");
  const event = await supabase.from("medication_events").insert({
    medication_id: medicine.id,
    patient_id: medicine.patientId,
    kind: "reminder_set",
    note: `Reminder saved for ${time}. Prescription instructions were not changed.`,
  });
  raise(event.error, "The reminder could not be saved.");
  if (actor.patientId !== medicine.patientId) return;
}

export async function setReminderEnabled(medicine: Medicine, enabled: boolean): Promise<void> {
  ensureReady();
  const updated = await supabase.from("medications").update({ reminder_enabled: enabled }).eq("id", medicine.id);
  raise(updated.error, "The reminder could not be changed.");
}

export async function saveMedicine(actor: Actor, input: { name: string; instructions: string; frequency: string; times: string[]; reminderEnabled: boolean }): Promise<string> {
  ensureReady();
  if (!actor.patientId) throw new Error("Only a patient can add a medicine.");
  const name = input.name.trim();
  const instructions = input.instructions.trim();
  const frequency = input.frequency.trim() || "As entered";
  if (!name) throw new Error("Medication name is required.");
  if (!instructions) throw new Error("Prescription instructions are required.");
  const times = [...new Set(input.times.filter(isTime))].sort();
  if (input.reminderEnabled && times.length === 0) throw new Error("Add a reminder time, or turn reminders off.");
  for (const time of times) {
    const blocked = reminderBlockReason({ name, instructions, frequency, times: times.filter((item) => item < time) }, time);
    if (blocked) throw new Error(blocked);
  }
  const prescriptionId = uuid();
  const medicationId = uuid();
  const prescription = await supabase.from("prescriptions").insert({
    id: prescriptionId,
    patient_id: actor.patientId,
    title: name,
    source_text: instructions,
  });
  raise(prescription.error, "The medicine could not be saved.");
  const medication = await supabase.from("medications").insert({
    id: medicationId,
    patient_id: actor.patientId,
    prescription_id: prescriptionId,
    name,
    instructions,
    frequency,
    times,
    reminder_enabled: input.reminderEnabled,
    status: "active",
    start_date: localDate(),
  });
  raise(medication.error, "The medicine could not be saved.");
  await supabase.from("prescriptions").update({ medication_id: medicationId }).eq("id", prescriptionId);
  await supabase.from("medication_events").insert({
    medication_id: medicationId,
    patient_id: actor.patientId,
    kind: "added",
    note: "Medication added by the patient.",
  });
  const timeline = await supabase.from("health_timeline").insert({
    patient_id: actor.patientId,
    kind: "medication_change",
    title: `Medication added: ${name}`,
    summary: instructions,
    source_label: "Entered by the patient from prescription information",
    ref_table: "medications",
    ref_id: medicationId,
  });
  raise(timeline.error, "The medicine could not be saved.");
  return medicationId;
}

export async function setVisitReminder(visitId: string, enabled: boolean): Promise<void> {
  ensureReady();
  const updated = await supabase.from("appointments").update({ reminder_enabled: enabled }).eq("id", visitId);
  raise(updated.error, "The visit reminder could not be changed.");
}

export async function listVisits(patientId: string): Promise<Visit[]> {
  ensureReady();
  const result = await supabase.from("appointments").select("*").eq("patient_id", patientId).order("starts_at", { ascending: true });
  raise(result.error, "Visits could not be loaded.");
  return ((result.data ?? []) as Row[]).map(visitFrom);
}

export async function saveVisit(
  actor: Actor,
  input: { provider: string; specialty: string; startsAt: string; location: string; notes: string; questions: string; reminderEnabled: boolean },
): Promise<void> {
  ensureReady();
  if (!actor.patientId) throw new Error("Only a patient can add a visit.");
  const provider = input.provider.trim();
  if (!provider) throw new Error("Who the visit is with is required.");
  const starts = parseWhen(input.startsAt);
  if (Number.isNaN(starts.getTime())) throw new Error("Choose a date and time.");
  const questions = input.questions
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const inserted = await supabase
    .from("appointments")
    .insert({
      patient_id: actor.patientId,
      provider,
      specialty: input.specialty.trim(),
      starts_at: starts.toISOString(),
      location: input.location.trim(),
      notes: input.notes.trim(),
      questions,
      reminder_enabled: input.reminderEnabled,
      status: "scheduled",
    })
    .select("id")
    .single();
  raise(inserted.error, "The visit could not be saved.");
  const id = text(inserted.data as Row, "id");
  const timeline = await supabase.from("health_timeline").insert({
    patient_id: actor.patientId,
    kind: "appointment",
    title: `Appointment: ${provider}`,
    summary: input.notes.trim(),
    source_label: "Entered by the patient",
    ref_table: "appointments",
    ref_id: id,
  });
  raise(timeline.error, "The visit could not be saved.");
}

export async function listConcerns(patientId: string): Promise<Concern[]> {
  ensureReady();
  const result = await supabase.from("health_concerns").select("id, description, analysis, shared_with_care_team, created_at").eq("patient_id", patientId).order("created_at", { ascending: false });
  raise(result.error, "Concerns could not be loaded.");
  return ((result.data ?? []) as Row[]).map((row) => {
    const analysis = row.analysis && typeof row.analysis === "object" ? (row.analysis as { summary?: string }) : null;
    return {
      id: text(row, "id"),
      description: text(row, "description"),
      shared: Boolean(row.shared_with_care_team),
      createdAt: text(row, "created_at"),
      summary: analysis?.summary ?? "",
    };
  });
}

export async function saveConcern(actor: Actor, description: string, shared: boolean): Promise<void> {
  ensureReady();
  if (!actor.patientId) throw new Error("Only a patient can check a concern.");
  const words = description.trim();
  if (words.length < 8) throw new Error("Describe what you noticed, in your own words.");
  const inserted = await supabase
    .from("health_concerns")
    .insert({ patient_id: actor.patientId, description: words, shared_with_care_team: shared })
    .select("id")
    .single();
  raise(inserted.error, "The concern could not be saved.");
  const id = text(inserted.data as Row, "id");
  const timeline = await supabase.from("health_timeline").insert({
    patient_id: actor.patientId,
    kind: "concern",
    title: "Health concern",
    summary: words.slice(0, 240),
    source_label: "Written by the patient",
    ref_table: "health_concerns",
    ref_id: id,
  });
  raise(timeline.error, "The concern could not be saved.");
}

const RANGE_LIMITS: Record<string, { label: string; unit: string; min: number; max: number }> = {
  heart_rate: { label: "Heart rate", unit: "bpm", min: 20, max: 250 },
  sleep_hours: { label: "Sleep", unit: "hours", min: 0, max: 24 },
  steps: { label: "Steps", unit: "steps", min: 0, max: 200_000 },
  blood_oxygen: { label: "Blood oxygen", unit: "%", min: 50, max: 100 },
};

export async function saveReadingRange(patientId: string, metric: string, lowRaw: string, highRaw: string): Promise<void> {
  ensureReady();
  const spec = RANGE_LIMITS[metric];
  if (!spec) throw new Error("Choose a reading.");
  const low = Number(lowRaw);
  const high = Number(highRaw);
  if (!Number.isFinite(low) || !Number.isFinite(high)) throw new Error(`${spec.label} needs a low and a high.`);
  const round = (value: number) => (metric === "sleep_hours" ? Math.round(value * 10) / 10 : Math.round(value));
  const lowValue = round(low);
  const highValue = round(high);
  if (lowValue < spec.min || lowValue > spec.max || highValue < spec.min || highValue > spec.max) {
    throw new Error(`${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`);
  }
  if (lowValue >= highValue) throw new Error("The low end of the range has to be below the high end.");
  const result = await supabase.from("reading_ranges").upsert({ patient_id: patientId, metric, low: lowValue, high: highValue }, { onConflict: "patient_id,metric" });
  raise(result.error, "The range could not be saved.");
}

export async function listReadings(patientId: string): Promise<{ readings: Reading[]; connections: Connection[]; ranges: Array<{ metric: string; low: string; high: string }> }> {
  ensureReady();
  const [readings, connections, ranges, used] = await Promise.all([
    supabase.from("device_readings").select("metric, value, unit, recorded_at, status").eq("patient_id", patientId).order("recorded_at", { ascending: false }).limit(40),
    supabase.from("device_connections").select("id, provider, label, status").eq("patient_id", patientId),
    supabase.from("reading_ranges").select("metric, low, high").eq("patient_id", patientId),
    supabase.from("device_readings").select("connection_id, recorded_at").eq("patient_id", patientId),
  ]);
  raise(readings.error, "Readings could not be loaded.");
  raise(connections.error, "Devices could not be loaded.");
  raise(ranges.error, "Saved ranges could not be loaded.");
  raise(used.error, "Devices could not be loaded.");
  const saved = new Map<string, { low: string; high: string }>();
  for (const row of (ranges.data ?? []) as Row[]) {
    saved.set(text(row, "metric"), { low: plainNumber(text(row, "low")), high: plainNumber(text(row, "high")) });
  }
  const lastReadingAt = new Map<string, string>();
  for (const row of (used.data ?? []) as Row[]) {
    const id = text(row, "connection_id");
    const at = text(row, "recorded_at");
    const previous = lastReadingAt.get(id);
    if (!previous || at > previous) lastReadingAt.set(id, at);
  }
  const withReadings = new Set(lastReadingAt.keys());
  const latest = new Map<string, Reading>();
  for (const row of (readings.data ?? []) as Row[]) {
    const metric = text(row, "metric");
    if (latest.has(metric)) continue;
    const range = saved.get(metric);
    latest.set(metric, {
      metric,
      label: METRIC_LABELS[metric] ?? metric,
      value: plainNumber(text(row, "value")),
      unit: text(row, "unit"),
      recordedAt: text(row, "recorded_at"),
      status: text(row, "status"),
      low: range?.low,
      high: range?.high,
    });
  }
  return {
    readings: [...latest.values()],
    connections: ((connections.data ?? []) as Row[])
      .filter((row) => withReadings.has(text(row, "id")))
      .map((row) => ({
        id: text(row, "id"),
        provider: text(row, "provider"),
        label: text(row, "label"),
        status: text(row, "status"),
        lastReadingAt: lastReadingAt.get(text(row, "id")) ?? null,
      })),
    ranges: [...saved.entries()].map(([metric, range]) => ({ metric, low: range.low, high: range.high })),
  };
}

export async function listTimeline(patientId: string): Promise<TimelineItem[]> {
  ensureReady();
  const result = await supabase.from("health_timeline").select("id, kind, title, summary, source_label, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(40);
  raise(result.error, "The timeline could not be loaded.");
  return ((result.data ?? []) as Row[]).map((row) => ({
    id: text(row, "id"),
    kind: text(row, "kind"),
    title: text(row, "title"),
    summary: text(row, "summary"),
    source: text(row, "source_label"),
    createdAt: text(row, "created_at"),
  }));
}

export async function loadHealth(patientId: string): Promise<HealthProfile | null> {
  ensureReady();
  const result = await supabase.from("patients").select("date_of_birth, address, emergency_contact, blood_type, allergies, conditions").eq("id", patientId).maybeSingle();
  raise(result.error, "The health summary could not be loaded.");
  if (!result.data) return null;
  const row = result.data as Row;
  return {
    dateOfBirth: text(row, "date_of_birth").slice(0, 10),
    address: text(row, "address"),
    emergencyContact: text(row, "emergency_contact"),
    bloodType: text(row, "blood_type"),
    allergies: text(row, "allergies"),
    conditions: text(row, "conditions"),
  };
}

export async function saveHealth(patientId: string, patch: Partial<HealthProfile>): Promise<void> {
  ensureReady();
  const payload: Row = {};
  if (patch.address !== undefined) payload.address = patch.address.trim();
  if (patch.emergencyContact !== undefined) payload.emergency_contact = patch.emergencyContact.trim();
  if (patch.bloodType !== undefined) payload.blood_type = patch.bloodType.trim();
  if (patch.allergies !== undefined) payload.allergies = patch.allergies.trim();
  if (patch.conditions !== undefined) payload.conditions = patch.conditions.trim();
  const result = await supabase.from("patients").update(payload).eq("id", patientId);
  raise(result.error, "The health summary could not be saved.");
}

export async function listDocuments(patientId: string): Promise<DocumentRow[]> {
  ensureReady();
  const result = await supabase.from("health_documents").select("id, title, kind, source_text, created_at").eq("patient_id", patientId).order("created_at", { ascending: false });
  raise(result.error, "Documents could not be loaded.");
  return ((result.data ?? []) as Row[]).map((row) => ({
    id: text(row, "id"),
    title: text(row, "title"),
    kind: text(row, "kind"),
    sourceText: text(row, "source_text"),
    createdAt: text(row, "created_at"),
  }));
}

export async function loadPerson(patientId: string, access: Access, includeHealth: boolean): Promise<PersonBundle> {
  const names = await namesFor([patientId]);
  const info = names.get(patientId);
  const [doses, medicines, visits, concerns, timeline, device, documents, health] = await Promise.all([
    access.medications || access.reminders ? todayDoses(patientId) : Promise.resolve([]),
    access.medications || access.reminders ? listMedicines(patientId) : Promise.resolve([]),
    access.appointments ? listVisits(patientId) : Promise.resolve([]),
    access.concerns ? listConcerns(patientId) : Promise.resolve([]),
    access.timeline ? listTimeline(patientId) : Promise.resolve([]),
    access.readings ? listReadings(patientId) : Promise.resolve({ readings: [], connections: [], ranges: [] }),
    access.timeline ? listDocuments(patientId) : Promise.resolve([]),
    includeHealth ? loadHealth(patientId) : Promise.resolve(null),
  ]);
  return {
    name: info?.name ?? "Patient",
    age: null,
    health,
    doses,
    medicines,
    visits,
    concerns,
    timeline,
    readings: device.readings,
    documents,
  };
}

export async function addDoctorNote(actor: Actor, patientId: string, body: string): Promise<void> {
  ensureReady();
  if (!actor.doctorId) throw new Error("Only a clinician can add a note.");
  const note = body.trim();
  if (!note) throw new Error("Write the note first.");
  const inserted = await supabase.from("doctor_notes").insert({ patient_id: patientId, doctor_id: actor.doctorId, body: note }).select("id").single();
  raise(inserted.error, "The note could not be saved.");
  const timeline = await supabase.from("health_timeline").insert({
    patient_id: patientId,
    kind: "doctor_note",
    title: `Note from ${actor.fullName}`,
    summary: note.slice(0, 240),
    source_label: "Written by the clinician",
    ref_table: "doctor_notes",
    ref_id: text(inserted.data as Row, "id"),
  });
  raise(timeline.error, "The note could not be saved.");
}

export async function listNotices(): Promise<Notice[]> {
  ensureReady();
  const result = await supabase.from("notifications").select("id, title, body, href, read, created_at").order("created_at", { ascending: false }).limit(50);
  raise(result.error, "Alerts could not be loaded.");
  return ((result.data ?? []) as Row[]).map((row) => ({
    id: text(row, "id"),
    title: text(row, "title"),
    body: text(row, "body"),
    href: text(row, "href") || null,
    read: Boolean(row.read),
    createdAt: text(row, "created_at"),
  }));
}

export async function markNoticeRead(id: string): Promise<void> {
  const result = await supabase.from("notifications").update({ read: true }).eq("id", id);
  raise(result.error, "That alert could not be updated.");
}

export async function listMessages(patientId: string): Promise<ChatMessage[]> {
  ensureReady();
  const result = await supabase.from("care_messages").select("id, patient_id, author_id, author_name, author_role, body, created_at").eq("patient_id", patientId).order("created_at", { ascending: true }).limit(200);
  raise(result.error, "Messages could not be loaded.");
  return ((result.data ?? []) as Row[]).map((row) => ({
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    authorId: text(row, "author_id"),
    authorName: text(row, "author_name"),
    authorRole: text(row, "author_role") as Role,
    body: text(row, "body"),
    createdAt: text(row, "created_at"),
  }));
}

export async function sendMessage(actor: Actor, patientId: string, body: string): Promise<void> {
  ensureReady();
  const message = body.trim();
  if (!message) throw new Error("Write a message first.");
  if (message.length > 2000) throw new Error("That message is too long.");
  const inserted = await supabase
    .from("care_messages")
    .insert({
      patient_id: patientId,
      author_id: actor.profileId,
      author_name: actor.fullName,
      author_role: actor.role,
      body: message,
    })
    .select("id")
    .single();
  raise(inserted.error, "The message could not be sent.");
  if (!webUrl) return;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;
  await fetch(`${webUrl}/api/mobile/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messageId: text(inserted.data as Row, "id") }),
  }).catch(() => undefined);
}

export async function markChatRead(patientId: string): Promise<void> {
  const result = await supabase.from("notifications").update({ read: true }).eq("read", false).or(`href.eq./patient/chat,href.ilike.%${patientId}%`);
  if (result.error) return;
}

export async function updateProfile(profileId: string, patch: { fullName?: string; phone?: string; textScale?: TextScale }): Promise<void> {
  ensureReady();
  const payload: Row = {};
  if (patch.fullName !== undefined) {
    const name = patch.fullName.trim();
    if (!name) throw new Error("Name is required.");
    payload.full_name = name;
  }
  if (patch.phone !== undefined) payload.phone = patch.phone.trim().slice(0, 40);
  if (patch.textScale !== undefined) payload.text_scale = patch.textScale;
  const result = await supabase.from("profiles").update(payload).eq("id", profileId);
  raise(result.error, "Settings could not be saved.");
}

export async function upcomingVisits(actor: Actor): Promise<Array<Visit & { patientName: string }>> {
  const people = actor.role === "patient" && actor.patientId ? [{ patientId: actor.patientId, name: actor.fullName }] : (await listPeople(actor)).map((person) => ({ patientId: person.patientId, name: person.name }));
  const visits: Array<Visit & { patientName: string }> = [];
  const now = Date.now();
  for (const person of people) {
    const rows = await listVisits(person.patientId);
    for (const visit of rows) {
      if (visit.status === "scheduled" && new Date(visit.startsAt).getTime() >= now - 60 * 60 * 1000) {
        visits.push({ ...visit, patientName: person.name });
      }
    }
  }
  return visits.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
