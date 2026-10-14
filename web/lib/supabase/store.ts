import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { nextAlarmAt, selectDueAlarms, type AlarmDraft, type DeliveredAlarm, type DueAlarm } from "@/lib/alarms/due";
import {
  AccessError,
  assertCan,
  canAddDoctorNote,
  canKnowPatient,
  canManageReminders,
  canReadFile,
  canViewArea,
  canRevisePrescription,
  canWriteOwnRecord,
  ValidationError,
  type AccessContext,
} from "@/lib/auth/access";
import type {
  AppointmentInput,
  DeviceBoard,
  DeviceSecret,
  ClinicianDocumentInput,
  DocumentInput,
  HealthPatch,
  HealthStore,
  MedicationInput,
  NewMessage,
  PatientCard,
  PatientChart,
  PermissionFlags,
  ProfilePatch,
  SignupInput,
  UploadInput,
} from "@/lib/data/types";
import { isMetric, isProvider, judgeReading, METRICS, parseMetricNumber } from "@/lib/devices/metrics";
import { reminderBlockReason, reminderCountReason } from "@/lib/medications/schedule";
import { fanOut } from "@/lib/notifications/channels";
import { chatNoticeMatchesPatient, isUnreadChatNotice } from "@/lib/notifications/chat";
import { supabasePublicEnv } from "@/lib/supabase/env";
import { requestUserClient } from "@/lib/supabase/request-user";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { atTime, formatTime, localDate } from "@/lib/time";
import type {
  Actor,
  CareMessage,
  AiMessage,
  AppNotification,
  Appointment,
  DeviceConnection,
  DeviceMetric,
  DeviceReading,
  DocumentKind,
  HealthConcern,
  HealthDocument,
  Medication,
  MedicationEvent,
  MedicationEventKind,
  NotificationKind,
  Patient,
  Prescription,
  Profile,
  Role,
  TextScale,
  TimelineEvent,
  TimelineKind,
} from "@/types/domain";

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value);
}

function clean(value: string, label: string, max = 4000): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${label} is required.`);
  if (trimmed.length > max) throw new ValidationError(`${label} is too long.`);
  return trimmed;
}

function cleanTimes(times: string[]): string[] {
  const unique = [...new Set(times.map((time) => time.trim()).filter(Boolean))].sort();
  for (const time of unique) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ValidationError("Use reminder times like 08:00 or 18:30.");
  }
  return unique;
}

function flagsOf(row: Row): PermissionFlags {
  return {
    viewMedications: Boolean(row.view_medications),
    viewAppointments: Boolean(row.view_appointments),
    viewTimeline: Boolean(row.view_timeline),
    viewConcerns: Boolean(row.view_concerns),
    viewReadings: Boolean(row.view_readings),
    manageReminders: Boolean(row.manage_reminders),
  };
}

function profileFrom(row: Row): Profile {
  return {
    id: text(row, "id"),
    email: text(row, "email"),
    role: text(row, "role") as Role,
    fullName: text(row, "full_name"),
    phone: text(row, "phone"),
    textScale: (text(row, "text_scale") || "default") as TextScale,
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function patientFrom(row: Row): Patient {
  return {
    id: text(row, "id"),
    profileId: text(row, "profile_id"),
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : "",
    address: text(row, "address"),
    emergencyContact: text(row, "emergency_contact"),
    bloodType: text(row, "blood_type"),
    allergies: text(row, "allergies"),
    conditions: text(row, "conditions"),
    fictional: Boolean(row.fictional),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function medicationFrom(row: Row): Medication {
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    name: text(row, "name"),
    instructions: text(row, "instructions"),
    frequency: text(row, "frequency"),
    times: Array.isArray(row.times) ? row.times.map(String) : [],
    startDate: row.start_date ? String(row.start_date).slice(0, 10) : "",
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
    prescribingProvider: text(row, "prescribing_provider"),
    notes: text(row, "notes"),
    prescriptionId: row.prescription_id ? text(row, "prescription_id") : null,
    status: text(row, "status") as Medication["status"],
    reminderEnabled: Boolean(row.reminder_enabled),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function eventFrom(row: Row): MedicationEvent {
  return {
    id: text(row, "id"),
    medicationId: text(row, "medication_id"),
    patientId: text(row, "patient_id"),
    kind: text(row, "kind") as MedicationEventKind,
    scheduledFor: row.scheduled_for ? text(row, "scheduled_for") : null,
    note: text(row, "note"),
    createdAt: text(row, "created_at"),
  };
}

function appointmentFrom(row: Row): Appointment {
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    provider: text(row, "provider"),
    specialty: text(row, "specialty"),
    startsAt: text(row, "starts_at"),
    location: text(row, "location"),
    notes: text(row, "notes"),
    questions: Array.isArray(row.questions) ? row.questions.map(String) : [],
    reminderEnabled: Boolean(row.reminder_enabled),
    status: text(row, "status") as Appointment["status"],
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function concernFrom(row: Row): HealthConcern {
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    description: text(row, "description"),
    imageFileId: row.image_file_id ? text(row, "image_file_id") : null,
    analysis: (row.analysis as HealthConcern["analysis"]) ?? null,
    sharedWithCareTeam: Boolean(row.shared_with_care_team),
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function documentFrom(row: Row): HealthDocument {
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    title: text(row, "title"),
    kind: text(row, "kind") as DocumentKind,
    fileId: row.file_id ? text(row, "file_id") : null,
    sourceText: text(row, "source_text"),
    aiExplanation: row.ai_explanation ? text(row, "ai_explanation") : null,
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function prescriptionFrom(row: Row): Prescription {
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    medicationId: row.medication_id ? text(row, "medication_id") : null,
    title: text(row, "title"),
    sourceText: text(row, "source_text"),
    fileId: row.file_id ? text(row, "file_id") : null,
    aiExplanation: row.ai_explanation ? text(row, "ai_explanation") : null,
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
  };
}

function timelineFrom(row: Row): TimelineEvent {
  return {
    id: text(row, "id"),
    patientId: text(row, "patient_id"),
    kind: text(row, "kind") as TimelineKind,
    title: text(row, "title"),
    summary: text(row, "summary"),
    sourceLabel: text(row, "source_label"),
    refTable: text(row, "ref_table"),
    refId: text(row, "ref_id"),
    createdAt: text(row, "created_at"),
  };
}

function messageFrom(row: Row): AiMessage {
  const source = row.source;
  return {
    id: text(row, "id"),
    conversationId: text(row, "conversation_id"),
    role: text(row, "role") as AiMessage["role"],
    content: text(row, "content"),
    proposedAction: (row.proposed_action as AiMessage["proposedAction"]) ?? null,
    actionStatus: (row.action_status as AiMessage["actionStatus"]) ?? null,
    medicationIds: Array.isArray(row.medication_ids) ? row.medication_ids.map(String) : [],
    source: source === "ai" || source === "rules" || source === "safety" ? source : undefined,
    createdAt: text(row, "created_at"),
  };
}

function notificationFrom(row: Row): AppNotification {
  return {
    id: text(row, "id"),
    profileId: text(row, "profile_id"),
    kind: text(row, "kind") as NotificationKind,
    title: text(row, "title"),
    body: text(row, "body"),
    href: row.href ? text(row, "href") : null,
    read: Boolean(row.read),
    createdAt: text(row, "created_at"),
    alarmKey: row.alarm_key ? text(row, "alarm_key") : undefined,
  };
}

export class SupabaseHealthStore implements HealthStore {
  private async db(): Promise<SupabaseClient> {
    return requestUserClient() ?? (await createSupabaseServerClient());
  }

  private admin(): SupabaseClient {
    return createSupabaseAdminClient();
  }

  private async context(): Promise<AccessContext> {
    const db = await this.db();
    const [{ data: links }, { data: grants }] = await Promise.all([
      db.from("patient_doctors").select("patient_id, doctor_id, status"),
      db.from("caregiver_permissions").select("patient_id, caregiver_id, status, view_medications, view_appointments, view_timeline, view_concerns, view_readings, manage_reminders"),
    ]);
    return {
      patientDoctors: ((links ?? []) as Row[]).map((row) => ({
        patientId: text(row, "patient_id"),
        doctorId: text(row, "doctor_id"),
        status: text(row, "status") as "active" | "revoked",
      })),
      caregiverPermissions: ((grants ?? []) as Row[]).map((row) => ({
        patientId: text(row, "patient_id"),
        caregiverId: text(row, "caregiver_id"),
        status: text(row, "status") as "active" | "revoked",
        ...flagsOf(row),
      })),
    };
  }

  private async notify(input: {
    profileId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    href: string | null;
    alarmKey?: string;
  }) {
    await fanOut(input);
    const { error } = await this.admin().from("notifications").insert({
      profile_id: input.profileId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href,
      alarm_key: input.alarmKey ?? null,
    });
    if (error && error.code !== "23505") throw new ValidationError(error.message);
  }

  private async identity(patientId: string): Promise<{ patient: Patient; profile: Profile }> {
    const db = await this.db();
    const visible = await db.from("patients").select("*").eq("id", patientId).maybeSingle();
    const source = visible.data ? db : this.admin();
    const patientRow = visible.data ?? (await source.from("patients").select("*").eq("id", patientId).maybeSingle()).data;
    if (!patientRow) throw new AccessError("That patient was not found.");
    const profileRow = (await source.from("profiles").select("*").eq("id", text(patientRow as Row, "profile_id")).maybeSingle()).data;
    if (!profileRow) throw new AccessError("That patient was not found.");
    return { patient: patientFrom(patientRow as Row), profile: profileFrom(profileRow as Row) };
  }

  async verifyCredentials(email: string, password: string): Promise<Profile | null> {
    const { url, key } = supabasePublicEnv();
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return null;
    const { data: profile } = await this.admin().from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    return profile ? profileFrom(profile as Row) : null;
  }

  async createAccount(input: SignupInput): Promise<Profile> {
    const admin = this.admin();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      app_metadata: {
        role: input.role,
        full_name: input.fullName.trim(),
        phone: input.phone?.trim() ?? "",
        specialty: input.specialty?.trim() ?? "",
        clinic: input.clinic?.trim() ?? "",
        relationship: input.relationship?.trim() ?? "",
      },
    });
    if (error || !data.user) throw new ValidationError(error?.message ?? "The account could not be created.");
    await this.finishAccount(admin, data.user.id, input);
    const { data: profile, error: profileError } = await admin.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
    if (profileError || !profile) throw new ValidationError("The account was created, but the profile trigger did not run. Apply the database migration.");
    return profileFrom(profile as Row);
  }

  private async finishAccount(admin: SupabaseClient, userId: string, input: SignupInput) {
    const fullName = input.fullName.trim();
    const phone = input.phone?.trim() ?? "";
    const { error } = await admin.from("profiles").update({ role: input.role, full_name: fullName, phone }).eq("id", userId);
    if (error) throw new ValidationError(error.message);
    if (input.role === "patient") {
      await admin.from("doctors").delete().eq("profile_id", userId);
      await admin.from("caregivers").delete().eq("profile_id", userId);
      const existing = await admin.from("patients").select("id").eq("profile_id", userId).maybeSingle();
      if (!existing.data) {
        const inserted = await admin.from("patients").insert({ profile_id: userId }).select("id").single();
        if (inserted.error) throw new ValidationError(inserted.error.message);
      }
      if (input.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) {
        await admin.from("patients").update({ date_of_birth: input.dateOfBirth }).eq("profile_id", userId);
      }
      return;
    }
    await admin.from("patients").delete().eq("profile_id", userId);
    if (input.role === "doctor") {
      await admin.from("caregivers").delete().eq("profile_id", userId);
      const fields = { specialty: input.specialty?.trim() ?? "", clinic: input.clinic?.trim() ?? "" };
      const existing = await admin.from("doctors").select("id").eq("profile_id", userId).maybeSingle();
      const saved = existing.data
        ? await admin.from("doctors").update(fields).eq("profile_id", userId)
        : await admin.from("doctors").insert({ profile_id: userId, ...fields });
      if (saved.error) throw new ValidationError(saved.error.message);
      return;
    }
    await admin.from("doctors").delete().eq("profile_id", userId);
    const relationship = input.relationship?.trim() ?? "";
    const existing = await admin.from("caregivers").select("id").eq("profile_id", userId).maybeSingle();
    const saved = existing.data
      ? await admin.from("caregivers").update({ relationship }).eq("profile_id", userId)
      : await admin.from("caregivers").insert({ profile_id: userId, relationship });
    if (saved.error) throw new ValidationError(saved.error.message);
  }

  async getActor(profileId: string): Promise<Actor | null> {
    const db = await this.db();
    const { data } = await db.from("profiles").select("*").eq("id", profileId).maybeSingle();
    if (!data) return null;
    const profile = profileFrom(data as Row);
    const [{ data: patient }, { data: doctor }, { data: caregiver }] = await Promise.all([
      db.from("patients").select("id").eq("profile_id", profileId).maybeSingle(),
      db.from("doctors").select("id").eq("profile_id", profileId).maybeSingle(),
      db.from("caregivers").select("id").eq("profile_id", profileId).maybeSingle(),
    ]);
    return {
      profileId,
      role: profile.role,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      textScale: profile.textScale,
      patientId: patient ? text(patient as Row, "id") : null,
      doctorId: doctor ? text(doctor as Row, "id") : null,
      caregiverId: caregiver ? text(caregiver as Row, "id") : null,
    };
  }

  async updateProfile(actor: Actor, patch: ProfilePatch): Promise<Profile> {
    const payload: Row = {};
    if (patch.fullName !== undefined) payload.full_name = clean(patch.fullName, "Full name", 160);
    if (patch.phone !== undefined) payload.phone = patch.phone.trim().slice(0, 40);
    if (patch.textScale !== undefined) payload.text_scale = patch.textScale;
    const db = await this.db();
    const { data, error } = await db.from("profiles").update(payload).eq("id", actor.profileId).select("*").single();
    if (error || !data) throw new AccessError();
    return profileFrom(data as Row);
  }

  async updateHealthProfile(actor: Actor, patch: HealthPatch): Promise<Patient> {
    if (!actor.patientId) throw new AccessError();
    assertCan(canWriteOwnRecord(actor, actor.patientId));
    const field = (value: string, max = 600) => {
      const trimmed = value.trim();
      if (trimmed.length > max) throw new ValidationError("One of the answers is too long.");
      return trimmed;
    };
    if (patch.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dateOfBirth)) {
      throw new ValidationError("Enter the date of birth as a date.");
    }
    const db = await this.db();
    const { data, error } = await db
      .from("patients")
      .update({
        date_of_birth: patch.dateOfBirth || null,
        address: field(patch.address, 240),
        emergency_contact: field(patch.emergencyContact, 240),
        blood_type: field(patch.bloodType, 12),
        allergies: field(patch.allergies),
        conditions: field(patch.conditions),
      })
      .eq("id", actor.patientId)
      .select("*")
      .single();
    if (error || !data) throw new AccessError();
    return patientFrom(data as Row);
  }

  async listPatientCards(actor: Actor): Promise<PatientCard[]> {
    const ctx = await this.context();
    const ids = new Set<string>();
    if (actor.role === "patient" && actor.patientId) ids.add(actor.patientId);
    if (actor.role === "doctor" && actor.doctorId) {
      for (const link of ctx.patientDoctors) {
        if (link.doctorId === actor.doctorId && link.status === "active") ids.add(link.patientId);
      }
    }
    if (actor.role === "caregiver" && actor.caregiverId) {
      for (const grant of ctx.caregiverPermissions) {
        if (grant.caregiverId === actor.caregiverId && grant.status === "active") ids.add(grant.patientId);
      }
    }
    const cards: PatientCard[] = [];
    for (const patientId of ids) {
      if (!canKnowPatient(actor, patientId, ctx)) continue;
      cards.push(await this.card(actor, patientId, ctx));
    }
    return cards;
  }

  private async card(actor: Actor, patientId: string, ctx: AccessContext): Promise<PatientCard> {
    const { patient, profile } = await this.identity(patientId);
    const db = await this.db();
    const see = (area: Parameters<typeof canViewArea>[2]) => canViewArea(actor, patientId, area, ctx);
    const grant = ctx.caregiverPermissions.find(
      (item) => item.patientId === patientId && item.caregiverId === actor.caregiverId && item.status === "active",
    );
    let nextAppointment: string | null = null;
    if (see("appointments")) {
      const { data } = await db
        .from("appointments")
        .select("starts_at")
        .eq("patient_id", patientId)
        .eq("status", "scheduled")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1);
      nextAppointment = data?.[0] ? text(data[0] as Row, "starts_at") : null;
    }
    const concerns = see("concerns")
      ? ((await db.from("health_concerns").select("id, description, analysis, created_at, shared_with_care_team").eq("patient_id", patientId).order("created_at", { ascending: false })).data ?? [])
          .map((row) => concernFrom(row as Row))
          .filter((item) => actor.role === "patient" || item.sharedWithCareTeam)
      : [];
    const latest = concerns[0];
    const { data: activity } = await db.from("health_timeline").select("created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1);
    let activeMedicationCount: number | null = null;
    if (see("medications")) {
      const { count } = await db.from("medications").select("id", { count: "exact", head: true }).eq("patient_id", patientId).eq("status", "active");
      activeMedicationCount = count ?? 0;
    }
    const isCaregiver = actor.role === "caregiver";
    return {
      patientId,
      fullName: profile.fullName,
      fictional: patient.fictional,
      dateOfBirth: isCaregiver && !see("overview") ? "" : patient.dateOfBirth,
      conditions: isCaregiver ? "" : patient.conditions,
      allergies: isCaregiver && !grant?.viewMedications ? "" : patient.allergies,
      nextAppointment,
      concernCount: concerns.length,
      activeMedicationCount,
      latestConcern: latest
        ? { id: latest.id, description: latest.description, urgency: latest.analysis?.urgency ?? null, createdAt: latest.createdAt }
        : null,
      lastActivity: activity?.[0] ? text(activity[0] as Row, "created_at") : null,
      access: isCaregiver && grant
        ? {
            viewMedications: grant.viewMedications,
            viewAppointments: grant.viewAppointments,
            viewTimeline: grant.viewTimeline,
            viewConcerns: grant.viewConcerns,
            viewReadings: grant.viewReadings,
            manageReminders: grant.manageReminders,
          }
        : "full",
    };
  }

  async getChart(actor: Actor, patientId: string): Promise<PatientChart> {
    const ctx = await this.context();
    assertCan(canKnowPatient(actor, patientId, ctx));
    const { patient: source, profile } = await this.identity(patientId);
    const fullRecord = actor.role !== "caregiver" || canViewArea(actor, patientId, "overview", ctx);
    const patient = fullRecord
      ? source
      : { ...source, address: "", emergencyContact: "", bloodType: "", allergies: "", conditions: "" };
    const db = await this.db();
    const see = (area: Parameters<typeof canViewArea>[2]) => canViewArea(actor, patientId, area, ctx);
    const rows = async (table: string) => ((await db.from(table).select("*").eq("patient_id", patientId)).data ?? []) as Row[];
    const notes = see("notes")
      ? await Promise.all(
          ((await db.from("doctor_notes").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })).data ?? []).map(async (row) => {
            const note = row as Row;
            const doctor = await this.admin().from("doctors").select("profile_id").eq("id", text(note, "doctor_id")).maybeSingle();
            const author = doctor.data
              ? await this.admin().from("profiles").select("full_name").eq("id", text(doctor.data as Row, "profile_id")).maybeSingle()
              : { data: null };
            return {
              id: text(note, "id"),
              patientId,
              doctorId: text(note, "doctor_id"),
              body: text(note, "body"),
              createdAt: text(note, "created_at"),
              updatedAt: text(note, "updated_at"),
              authorName: author.data ? text(author.data as Row, "full_name") : "Clinician",
            };
          }),
        )
      : null;
    const grant = ctx.caregiverPermissions.find(
      (item) => item.patientId === patientId && item.caregiverId === actor.caregiverId && item.status === "active",
    );
    return {
      patient,
      profile,
      medications: see("medications") ? (await rows("medications")).map(medicationFrom) : null,
      medicationEvents: see("medications") ? (await rows("medication_events")).map(eventFrom) : null,
      appointments: see("appointments") ? (await rows("appointments")).map(appointmentFrom) : null,
      concerns: see("concerns")
        ? (await rows("health_concerns")).map(concernFrom).filter((item) => actor.role === "patient" || item.sharedWithCareTeam)
        : null,
      timeline: (await db.from("health_timeline").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })).data?.map((row) => timelineFrom(row as Row)) ?? [],
      documents: see("documents") ? (await rows("health_documents")).map(documentFrom) : null,
      prescriptions: see("medications") ? (await rows("prescriptions")).map(prescriptionFrom) : null,
      notes,
      careTeam: canWriteOwnRecord(actor, patientId) ? await this.careTeam(patientId) : null,
      canManageReminders: canManageReminders(actor, patientId, ctx),
      access: actor.role === "caregiver" && grant
        ? {
            viewMedications: grant.viewMedications,
            viewAppointments: grant.viewAppointments,
            viewTimeline: grant.viewTimeline,
            viewConcerns: grant.viewConcerns,
            viewReadings: grant.viewReadings,
            manageReminders: grant.manageReminders,
          }
        : "full",
    };
  }

  private async careTeam(patientId: string): Promise<PatientChart["careTeam"]> {
    const admin = this.admin();
    const { data: links } = await admin.from("patient_doctors").select("*").eq("patient_id", patientId);
    const { data: grants } = await admin.from("caregiver_permissions").select("*").eq("patient_id", patientId);
    const doctors = [];
    for (const row of (links ?? []) as Row[]) {
      const doctor = (await admin.from("doctors").select("*").eq("id", text(row, "doctor_id")).maybeSingle()).data as Row | null;
      const profile = doctor ? ((await admin.from("profiles").select("*").eq("id", text(doctor, "profile_id")).maybeSingle()).data as Row | null) : null;
      doctors.push({
        linkId: text(row, "id"),
        name: profile ? text(profile, "full_name") : "Clinician",
        email: profile ? text(profile, "email") : "",
        specialty: doctor ? text(doctor, "specialty") : "",
        clinic: doctor ? text(doctor, "clinic") : "",
        status: text(row, "status") as "active" | "revoked",
        authorizedAt: text(row, "authorized_at"),
      });
    }
    const caregivers = [];
    for (const row of (grants ?? []) as Row[]) {
      const caregiver = (await admin.from("caregivers").select("*").eq("id", text(row, "caregiver_id")).maybeSingle()).data as Row | null;
      const profile = caregiver ? ((await admin.from("profiles").select("*").eq("id", text(caregiver, "profile_id")).maybeSingle()).data as Row | null) : null;
      caregivers.push({
        permissionId: text(row, "id"),
        name: profile ? text(profile, "full_name") : "Caregiver",
        email: profile ? text(profile, "email") : "",
        relationship: caregiver ? text(caregiver, "relationship") : "",
        status: text(row, "status") as "active" | "revoked",
        flags: flagsOf(row),
      });
    }
    return { doctors, caregivers };
  }

  async todayDoses(actor: Actor, patientId: string) {
    const ctx = await this.context();
    assertCan(canViewArea(actor, patientId, "medications", ctx));
    const db = await this.db();
    const { data: medications } = await db.from("medications").select("*").eq("patient_id", patientId).eq("status", "active");
    const { data: events } = await db.from("medication_events").select("*").eq("patient_id", patientId).eq("kind", "taken");
    const day = localDate();
    return ((medications ?? []) as Row[]).map(medicationFrom).flatMap((medication) =>
      medication.times.map((time) => {
        const scheduledFor = atTime(day, time);
        const taken = ((events ?? []) as Row[]).some((event) => text(event, "medication_id") === medication.id && text(event, "scheduled_for") === scheduledFor);
        return { medication, time, scheduledFor, taken };
      }),
    );
  }

  async getMedication(actor: Actor, id: string) {
    const db = await this.db();
    const { data } = await db.from("medications").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AccessError("That medication was not found.");
    const medication = medicationFrom(data as Row);
    const ctx = await this.context();
    assertCan(canViewArea(actor, medication.patientId, "medications", ctx));
    const { data: prescription } = medication.prescriptionId
      ? await db.from("prescriptions").select("*").eq("id", medication.prescriptionId).maybeSingle()
      : { data: null };
    const { data: events } = await db.from("medication_events").select("*").eq("medication_id", id).order("created_at", { ascending: false });
    return {
      medication,
      prescription: prescription ? prescriptionFrom(prescription as Row) : null,
      events: ((events ?? []) as Row[]).map(eventFrom),
    };
  }

  private async requireMedication(id: string): Promise<Medication> {
    const { data } = await (await this.db()).from("medications").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AccessError("That medication was not found.");
    return medicationFrom(data as Row);
  }

  async saveMedication(actor: Actor, input: MedicationInput, id?: string): Promise<Medication> {
    const times = cleanTimes(input.times);
    const tooMany = reminderCountReason(input.instructions, input.frequency, times);
    if (tooMany) throw new ValidationError(tooMany);
    const payload = {
      name: clean(input.name, "Medication name", 160),
      instructions: clean(input.instructions, "Prescription instructions"),
      frequency: clean(input.frequency, "How often", 160),
      times,
      start_date: input.startDate || localDate(),
      end_date: input.endDate,
      prescribing_provider: input.prescribingProvider.trim(),
      notes: input.notes.trim(),
      reminder_enabled: input.reminderEnabled,
    };
    const db = await this.db();
    let labelFileId: string | null = null;
    if (input.labelFileId) {
      const file = await db.from("health_files").select("id, patient_id, bucket").eq("id", input.labelFileId).maybeSingle();
      const row = file.data as Row | null;
      if (!row || text(row, "patient_id") !== actor.patientId || text(row, "bucket") !== "prescriptions") {
        throw new AccessError("That label photo is not in this record.");
      }
      labelFileId = text(row, "id");
    }
    if (!id) {
      if (!actor.patientId) throw new AccessError();
      assertCan(canWriteOwnRecord(actor, actor.patientId));
      const prescriptionId = crypto.randomUUID();
      const medicationId = crypto.randomUUID();
      const { error: prescriptionError } = await db.from("prescriptions").insert({
        id: prescriptionId,
        patient_id: actor.patientId,
        title: payload.name,
        source_text: payload.instructions,
        file_id: labelFileId,
      });
      if (prescriptionError) throw new ValidationError(prescriptionError.message);
      const { data, error } = await db
        .from("medications")
        .insert({ ...payload, id: medicationId, patient_id: actor.patientId, prescription_id: prescriptionId, status: "active" })
        .select("*")
        .single();
      if (error || !data) throw new ValidationError(error?.message ?? "The medicine could not be saved.");
      await db.from("prescriptions").update({ medication_id: medicationId }).eq("id", prescriptionId);
      await db.from("medication_events").insert({
        medication_id: medicationId,
        patient_id: actor.patientId,
        kind: "added",
        note: "Medication added by the patient.",
      });
      await db.from("health_timeline").insert({
        patient_id: actor.patientId,
        kind: "medication_change",
        title: `Medication added: ${payload.name}`,
        summary: payload.instructions,
        source_label: "Entered by the patient from prescription information",
        ref_table: "medications",
        ref_id: medicationId,
      });
      return medicationFrom(data as Row);
    }
    const current = await this.requireMedication(id);
    const ctx = await this.context();
    const own = canWriteOwnRecord(actor, current.patientId);
    assertCan(canRevisePrescription(actor, current.patientId, ctx), "Only the patient or their clinician can change this prescription.");
    const { data, error } = await db.from("medications").update(payload).eq("id", id).select("*").single();
    if (error || !data) throw new ValidationError(error?.message ?? "The prescription could not be saved.");
    const medication = medicationFrom(data as Row);
    if (medication.prescriptionId) {
      const prescriptionPatch: Row = { source_text: medication.instructions, title: medication.name };
      if (current.instructions !== medication.instructions) prescriptionPatch.ai_explanation = null;
      if (labelFileId) prescriptionPatch.file_id = labelFileId;
      const saved = await db.from("prescriptions").update(prescriptionPatch).eq("id", medication.prescriptionId);
      if (saved.error) throw new ValidationError(saved.error.message);
    }
    const summary = current.instructions !== medication.instructions ? `Now: ${medication.instructions}\n\nPreviously: ${current.instructions}` : medication.instructions;
    await db.from("medication_events").insert({
      medication_id: medication.id,
      patient_id: medication.patientId,
      kind: "updated",
      note: own ? "Patient updated the saved prescription information." : `${actor.fullName} updated the saved prescription. The assistant did not write this change.`,
    });
    await db.from("health_timeline").insert({
      patient_id: medication.patientId,
      kind: "medication_change",
      title: `Medication updated: ${medication.name}`,
      summary,
      source_label: own
        ? "Updated by the patient. The AI did not change this text."
        : `Updated by ${actor.fullName}. The previous prescription text stays in this note. The assistant did not write this change.`,
      ref_table: "medications",
      ref_id: medication.id,
    });
    if (!own) {
      const { patient } = await this.identity(medication.patientId);
      await this.notify({
        profileId: patient.profileId,
        kind: "medication",
        title: `Prescription updated: ${medication.name}`,
        body: `${actor.fullName} updated the saved prescription. It now says: ${medication.instructions}`,
        href: `/patient/medications/${medication.id}`,
      });
    }
    return medication;
  }

  async archiveMedication(actor: Actor, id: string): Promise<void> {
    const medication = await this.requireMedication(id);
    assertCan(canWriteOwnRecord(actor, medication.patientId));
    const db = await this.db();
    const { error } = await db.from("medications").update({ status: "archived" }).eq("id", id);
    if (error) throw new AccessError();
    await db.from("health_timeline").insert({
      patient_id: medication.patientId,
      kind: "medication_change",
      title: `Medication archived: ${medication.name}`,
      summary: "The patient archived this medication. The original instructions are still saved.",
      source_label: "Changed by the patient",
      ref_table: "medications",
      ref_id: medication.id,
    });
  }

  async markTaken(actor: Actor, medicationId: string, time: string): Promise<void> {
    const medication = await this.requireMedication(medicationId);
    const own = canWriteOwnRecord(actor, medication.patientId);
    const ctx = await this.context();
    assertCan(own || canManageReminders(actor, medication.patientId, ctx));
    const [cleanTime] = cleanTimes([time]);
    if (!cleanTime) throw new ValidationError("Choose a reminder time.");
    const scheduledFor = atTime(localDate(), cleanTime);
    const db = await this.db();
    const existing = await db.from("medication_events").select("id").eq("medication_id", medicationId).eq("kind", "taken").eq("scheduled_for", scheduledFor).limit(1);
    if (existing.data && existing.data.length > 0) return;
    const { error } = await db.from("medication_events").insert({
      medication_id: medicationId,
      patient_id: medication.patientId,
      kind: "taken",
      scheduled_for: scheduledFor,
      note: own ? "Marked taken by the patient." : `Marked taken by ${actor.fullName} (caregiver).`,
    });
    if (error) throw new ValidationError(error.message);
    await db.from("health_timeline").insert({
      patient_id: medication.patientId,
      kind: "medication_activity",
      title: `Taken: ${medication.name}`,
      summary: `Marked taken for ${formatTime(cleanTime)}. Instructions remain: ${medication.instructions}`,
      source_label: own ? "Recorded by the patient" : `Recorded by ${actor.fullName}, caregiver`,
      ref_table: "medications",
      ref_id: medication.id,
    });
  }

  async setReminder(actor: Actor, medicationId: string, time: string): Promise<void> {
    const medication = await this.requireMedication(medicationId);
    const ctx = await this.context();
    assertCan(canManageReminders(actor, medication.patientId, ctx), "You cannot change reminders for this person.");
    const [cleanTime] = cleanTimes([time]);
    if (!cleanTime) throw new ValidationError("Choose a reminder time.");
    const blocked = reminderBlockReason(medication, cleanTime);
    if (blocked) throw new ValidationError(blocked);
    const instructions = medication.instructions;
    const db = await this.db();
    const { error } = await db
      .from("medications")
      .update({ times: [...medication.times, cleanTime].sort(), reminder_enabled: true })
      .eq("id", medicationId);
    if (error) throw new ValidationError(error.message);
    const { error: eventError } = await db.from("medication_events").insert({
      medication_id: medicationId,
      patient_id: medication.patientId,
      kind: "reminder_set",
      scheduled_for: null,
      note: `Reminder saved for ${formatTime(cleanTime)}. Prescription instructions were not changed.`,
    });
    if (eventError) throw new ValidationError(eventError.message);
    const { patient } = await this.identity(medication.patientId);
    await this.notify({
      profileId: patient.profileId,
      kind: "medication",
      title: `Reminder for ${medication.name}`,
      body: `A reminder was saved for ${formatTime(cleanTime)}. The prescription still says: ${instructions}`,
      href: `/patient/medications/${medication.id}`,
    });
    const after = await db.from("medications").select("instructions").eq("id", medicationId).single();
    if (!after.data || text(after.data as Row, "instructions") !== instructions) {
      throw new ValidationError("The prescription text changed unexpectedly.");
    }
  }

  async getAppointment(actor: Actor, id: string): Promise<Appointment> {
    const db = await this.db();
    const { data } = await db.from("appointments").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AccessError("That appointment was not found.");
    const appointment = appointmentFrom(data as Row);
    const ctx = await this.context();
    assertCan(canViewArea(actor, appointment.patientId, "appointments", ctx));
    return appointment;
  }

  async saveAppointment(actor: Actor, input: AppointmentInput, id?: string): Promise<Appointment> {
    const starts = new Date(input.startsAt);
    if (Number.isNaN(starts.getTime())) throw new ValidationError("Enter a valid date and time.");
    const payload = {
      provider: clean(input.provider, "Provider", 160),
      specialty: input.specialty.trim(),
      starts_at: starts.toISOString(),
      location: input.location.trim(),
      notes: input.notes.trim(),
      questions: input.questions.map((question) => question.trim()).filter(Boolean).slice(0, 20),
      reminder_enabled: input.reminderEnabled,
    };
    const db = await this.db();
    if (!id) {
      if (!actor.patientId) throw new AccessError();
      assertCan(canWriteOwnRecord(actor, actor.patientId));
      const { data, error } = await db.from("appointments").insert({ ...payload, patient_id: actor.patientId, status: "scheduled" }).select("*").single();
      if (error || !data) throw new ValidationError(error?.message ?? "The appointment could not be saved.");
      const appointment = appointmentFrom(data as Row);
      await db.from("health_timeline").insert({
        patient_id: actor.patientId,
        kind: "appointment",
        title: `Appointment with ${appointment.provider}`,
        summary: `${appointment.specialty} at ${appointment.location}`,
        source_label: "Saved by the patient",
        ref_table: "appointments",
        ref_id: appointment.id,
      });
      if (appointment.reminderEnabled) {
        await this.notify({
          profileId: actor.profileId,
          kind: "appointment",
          title: `Visit with ${appointment.provider}`,
          body: "An appointment reminder was saved.",
          href: `/patient/appointments/${appointment.id}`,
        });
      }
      return appointment;
    }
    const current = await this.getAppointment(actor, id);
    assertCan(canWriteOwnRecord(actor, current.patientId));
    const { data, error } = await db.from("appointments").update(payload).eq("id", id).select("*").single();
    if (error || !data) throw new ValidationError(error?.message ?? "The appointment could not be saved.");
    return appointmentFrom(data as Row);
  }

  async archiveAppointment(actor: Actor, id: string): Promise<void> {
    const appointment = await this.getAppointment(actor, id);
    assertCan(canWriteOwnRecord(actor, appointment.patientId));
    const { error } = await (await this.db()).from("appointments").update({ status: "archived" }).eq("id", id);
    if (error) throw new AccessError();
  }

  async listSchedule(actor: Actor) {
    const db = await this.db();
    const { data } = await db.from("appointments").select("*").neq("status", "archived").order("starts_at");
    const ctx = await this.context();
    const visits = [];
    for (const row of (data ?? []) as Row[]) {
      const appointment = appointmentFrom(row);
      if (!canViewArea(actor, appointment.patientId, "appointments", ctx)) continue;
      const { profile } = await this.identity(appointment.patientId);
      visits.push({ ...appointment, patientName: profile.fullName });
    }
    return visits;
  }

  async getConcern(actor: Actor, id: string): Promise<HealthConcern> {
    const db = await this.db();
    const { data } = await db.from("health_concerns").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AccessError("That health concern was not found.");
    const concern = concernFrom(data as Row);
    const ctx = await this.context();
    assertCan(canViewArea(actor, concern.patientId, "concerns", ctx));
    if (actor.role !== "patient" && !concern.sharedWithCareTeam) throw new AccessError("This concern has not been shared with the care team.");
    return concern;
  }

  async createConcern(
    actor: Actor,
    input: { patientId: string; description: string; imageFileId: string | null; analysis: HealthConcern["analysis"]; sharedWithCareTeam: boolean },
  ): Promise<HealthConcern> {
    assertCan(canWriteOwnRecord(actor, input.patientId));
    const db = await this.db();
    if (input.imageFileId) {
      const file = await db.from("health_files").select("patient_id").eq("id", input.imageFileId).maybeSingle();
      if (!file.data || text(file.data as Row, "patient_id") !== input.patientId) throw new AccessError("That image is not in this record.");
    }
    const { data, error } = await db
      .from("health_concerns")
      .insert({
        patient_id: input.patientId,
        description: clean(input.description, "Description"),
        image_file_id: input.imageFileId,
        analysis: input.analysis,
        shared_with_care_team: input.sharedWithCareTeam,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The concern could not be saved.");
    const concern = concernFrom(data as Row);
    await db.from("health_timeline").insert({
      patient_id: input.patientId,
      kind: "concern",
      title: "Health concern saved",
      summary: concern.description,
      source_label: "Submitted by the patient. The AI response is separate from this description.",
      ref_table: "health_concerns",
      ref_id: concern.id,
    });
    if (input.sharedWithCareTeam) await this.shareConcern(actor, concern);
    return concern;
  }

  private async shareConcern(actor: Actor, concern: HealthConcern) {
    const db = await this.db();
    const { data: links } = await db.from("patient_doctors").select("doctor_id").eq("patient_id", concern.patientId).eq("status", "active");
    for (const link of (links ?? []) as Row[]) {
      const doctor = await db.from("doctors").select("profile_id").eq("id", text(link, "doctor_id")).maybeSingle();
      if (!doctor.data) continue;
      await this.notify({
        profileId: text(doctor.data as Row, "profile_id"),
        kind: "app",
        title: "Shared health concern",
        body: `${actor.fullName} shared a health concern for your review.`,
        href: `/doctor/patients/${concern.patientId}`,
      });
    }
  }

  async setConcernSharing(actor: Actor, id: string, shared: boolean): Promise<void> {
    const concern = await this.getConcern(actor, id);
    assertCan(canWriteOwnRecord(actor, concern.patientId));
    const { error } = await (await this.db()).from("health_concerns").update({ shared_with_care_team: shared }).eq("id", id);
    if (error) throw new AccessError();
    if (shared && !concern.sharedWithCareTeam) await this.shareConcern(actor, concern);
  }

  async getTimelineEvent(actor: Actor, id: string): Promise<TimelineEvent> {
    const db = await this.db();
    const { data } = await db.from("health_timeline").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AccessError();
    const event = timelineFrom(data as Row);
    const ctx = await this.context();
    assertCan(canKnowPatient(actor, event.patientId, ctx));
    return event;
  }

  async addPatientNote(actor: Actor, patientId: string, body: string): Promise<void> {
    assertCan(canWriteOwnRecord(actor, patientId));
    const db = await this.db();
    const { data, error } = await db.from("health_documents").insert({ patient_id: patientId, title: "Patient note", kind: "other", source_text: clean(body, "Note") }).select("id").single();
    if (error || !data) throw new ValidationError(error?.message ?? "The note could not be saved.");
    await db.from("health_timeline").insert({
      patient_id: patientId,
      kind: "patient_note",
      title: "Note from the patient",
      summary: body.trim(),
      source_label: "Written by the patient",
      ref_table: "health_documents",
      ref_id: text(data as Row, "id"),
    });
  }

  async addDoctorNote(actor: Actor, patientId: string, body: string) {
    const ctx = await this.context();
    assertCan(canAddDoctorNote(actor, patientId, ctx));
    if (!actor.doctorId) throw new AccessError();
    const db = await this.db();
    const { data, error } = await db.from("doctor_notes").insert({ patient_id: patientId, doctor_id: actor.doctorId, body: clean(body, "Note") }).select("*").single();
    if (error || !data) throw new AccessError();
    const row = data as Row;
    await db.from("health_timeline").insert({
      patient_id: patientId,
      kind: "doctor_note",
      title: `Note from ${actor.fullName}`,
      summary: body.trim(),
      source_label: "Healthcare professional note",
      ref_table: "doctor_notes",
      ref_id: text(row, "id"),
    });
    const { patient } = await this.identity(patientId);
    await this.notify({
      profileId: patient.profileId,
      kind: "doctor_message",
      title: `Note from ${actor.fullName}`,
      body: "Your clinician added a note to your record.",
      href: "/patient/timeline",
    });
    return {
      id: text(row, "id"),
      patientId,
      doctorId: actor.doctorId,
      body: text(row, "body"),
      createdAt: text(row, "created_at"),
      updatedAt: text(row, "updated_at"),
    };
  }

  async addDocument(actor: Actor, input: DocumentInput): Promise<HealthDocument> {
    if (!actor.patientId) throw new AccessError();
    assertCan(canWriteOwnRecord(actor, actor.patientId));
    const db = await this.db();
    if (input.fileId) {
      const file = await db.from("health_files").select("patient_id").eq("id", input.fileId).maybeSingle();
      if (!file.data || text(file.data as Row, "patient_id") !== actor.patientId) throw new AccessError("That file is not in this record.");
    }
    if (!input.fileId && !input.sourceText.trim()) throw new ValidationError("Add a file or paste the document text.");
    const { data, error } = await db
      .from("health_documents")
      .insert({
        patient_id: actor.patientId,
        title: clean(input.title, "Title", 160),
        kind: input.kind,
        file_id: input.fileId,
        source_text: input.sourceText.trim().slice(0, 12000),
        ai_explanation: input.aiExplanation,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The document could not be saved.");
    const document = documentFrom(data as Row);
    await db.from("health_timeline").insert({
      patient_id: actor.patientId,
      kind: "document",
      title: `Document added: ${document.title}`,
      summary: document.sourceText ? document.sourceText.slice(0, 400) : "A file was uploaded.",
      source_label: "Uploaded by the patient",
      ref_table: "health_documents",
      ref_id: document.id,
    });
    return document;
  }

  async addClinicianDocument(actor: Actor, input: ClinicianDocumentInput): Promise<HealthDocument> {
    if (actor.role !== "doctor") throw new AccessError("Only a clinician can add a record this way.");
    const ctx = await this.context();
    assertCan(canViewArea(actor, input.patientId, "documents", ctx));
    const kinds = ["prescription", "record", "lab", "other"];
    if (!kinds.includes(input.kind)) throw new ValidationError("Choose a document kind.");
    const db = await this.db();
    let fileId: string | null = null;
    if (input.file) {
      const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
      if (input.file.data.length === 0) throw new ValidationError("Choose a file to upload.");
      if (input.file.data.length > 8 * 1024 * 1024) throw new ValidationError("Files need to be 8 MB or smaller.");
      if (!allowed.includes(input.file.mimeType)) throw new ValidationError("Upload a photo, PDF, or text file.");
      fileId = crypto.randomUUID();
      const storagePath = `${input.patientId}/${fileId}`;
      const uploaded = await db.storage.from("health-files").upload(storagePath, input.file.data, { contentType: input.file.mimeType, upsert: false });
      if (uploaded.error) throw new ValidationError(uploaded.error.message);
      const fileRow = await db.from("health_files").insert({
        id: fileId,
        patient_id: input.patientId,
        bucket: "documents",
        storage_path: storagePath,
        file_name: input.file.fileName.slice(0, 180) || "upload",
        mime_type: input.file.mimeType,
        bytes: input.file.data.length,
      });
      if (fileRow.error) throw new ValidationError(fileRow.error.message);
    }
    if (!fileId && !input.sourceText.trim()) throw new ValidationError("Add a file or paste the document text.");
    const { data, error } = await db
      .from("health_documents")
      .insert({
        patient_id: input.patientId,
        title: clean(input.title, "Title", 160),
        kind: input.kind,
        file_id: fileId,
        source_text: input.sourceText.trim().slice(0, 12000),
        ai_explanation: input.aiExplanation,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The document could not be saved.");
    const document = documentFrom(data as Row);
    await db.from("health_timeline").insert({
      patient_id: input.patientId,
      kind: "document",
      title: `Document added: ${document.title}`,
      summary: document.sourceText ? document.sourceText.slice(0, 400) : "A file was added.",
      source_label: `Added by ${actor.fullName}`,
      ref_table: "health_documents",
      ref_id: document.id,
    });
    const { patient } = await this.identity(input.patientId);
    await this.notify({
      profileId: patient.profileId,
      kind: "doctor_message",
      title: `${actor.fullName} added a document`,
      body: "The original file or text is on your health page.",
      href: `/patient/health/documents/${document.id}`,
    });
    return document;
  }

  async getDocument(actor: Actor, id: string): Promise<HealthDocument> {
    const db = await this.db();
    const { data } = await db.from("health_documents").select("*").eq("id", id).maybeSingle();
    if (!data) throw new AccessError("That document was not found.");
    const document = documentFrom(data as Row);
    const ctx = await this.context();
    assertCan(canViewArea(actor, document.patientId, "documents", ctx));
    return document;
  }

  async saveDocumentExplanation(actor: Actor, id: string, explanation: string): Promise<void> {
    const document = await this.getDocument(actor, id);
    assertCan(canWriteOwnRecord(actor, document.patientId));
    const before = document.sourceText;
    const db = await this.db();
    const { error } = await db.from("health_documents").update({ ai_explanation: clean(explanation, "Explanation", 8000) }).eq("id", id);
    if (error) throw new ValidationError(error.message);
    const after = await db.from("health_documents").select("source_text").eq("id", id).single();
    if (!after.data || text(after.data as Row, "source_text") !== before) {
      throw new ValidationError("The original document was protected from change.");
    }
  }

  async saveUpload(actor: Actor, input: UploadInput): Promise<{ id: string }> {
    assertCan(canWriteOwnRecord(actor, input.patientId));
    if (input.data.length === 0) throw new ValidationError("Choose a file to upload.");
    if (input.data.length > 8 * 1024 * 1024) throw new ValidationError("Files need to be 8 MB or smaller.");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "application/pdf", "text/plain"];
    if (!allowed.includes(input.mimeType)) throw new ValidationError("Upload a photo, PDF, or text file.");
    const id = crypto.randomUUID();
    const path = `${input.patientId}/${id}`;
    const db = await this.db();
    const uploaded = await db.storage.from("health-files").upload(path, input.data, { contentType: input.mimeType, upsert: false });
    if (uploaded.error) throw new ValidationError(uploaded.error.message);
    const { error } = await db.from("health_files").insert({
      id,
      patient_id: input.patientId,
      bucket: input.bucket,
      storage_path: path,
      file_name: input.fileName.slice(0, 180) || "upload",
      mime_type: input.mimeType,
      bytes: input.data.length,
    });
    if (error) throw new ValidationError(error.message);
    return { id };
  }

  async readUpload(actor: Actor, fileId: string) {
    const db = await this.db();
    const { data } = await db.from("health_files").select("*").eq("id", fileId).maybeSingle();
    if (!data) throw new AccessError("That file was not found.");
    const row = data as Row;
    const ctx = await this.context();
    assertCan(canReadFile(actor, text(row, "patient_id"), text(row, "bucket") as UploadInput["bucket"], ctx));
    const downloaded = await db.storage.from("health-files").download(text(row, "storage_path"));
    if (downloaded.error || !downloaded.data) throw new ValidationError("This file is no longer available.");
    return { mimeType: text(row, "mime_type"), fileName: text(row, "file_name"), data: Buffer.from(await downloaded.data.arrayBuffer()) };
  }

  async savePrescriptionExplanation(actor: Actor, prescriptionId: string, explanation: string): Promise<void> {
    const db = await this.db();
    const { data } = await db.from("prescriptions").select("*").eq("id", prescriptionId).maybeSingle();
    if (!data) throw new AccessError("That prescription was not found.");
    const before = text(data as Row, "source_text");
    const ctx = await this.context();
    assertCan(canViewArea(actor, text(data as Row, "patient_id"), "medications", ctx));
    assertCan(canWriteOwnRecord(actor, text(data as Row, "patient_id")));
    const { error } = await db.from("prescriptions").update({ ai_explanation: clean(explanation, "Explanation") }).eq("id", prescriptionId);
    if (error) throw new ValidationError(error.message);
    const after = await db.from("prescriptions").select("source_text").eq("id", prescriptionId).single();
    if (!after.data || text(after.data as Row, "source_text") !== before) {
      throw new ValidationError("The original prescription was protected from change.");
    }
  }

  async getConversation(actor: Actor) {
    if (actor.role !== "patient" || !actor.patientId) throw new AccessError("The assistant uses your own health record.");
    const db = await this.db();
    let { data } = await db.from("ai_conversations").select("*").eq("patient_id", actor.patientId).maybeSingle();
    if (!data) {
      const created = await db.from("ai_conversations").insert({ patient_id: actor.patientId, title: "Health assistant" }).select("*").single();
      data = created.data;
    }
    if (!data) throw new ValidationError("The assistant conversation could not be opened.");
    const conversationId = text(data as Row, "id");
    const { data: messages } = await db.from("ai_messages").select("*").eq("conversation_id", conversationId).order("created_at");
    return { id: conversationId, messages: ((messages ?? []) as Row[]).map(messageFrom) };
  }

  async appendMessage(actor: Actor, input: NewMessage): Promise<AiMessage> {
    const conversation = await this.getConversation(actor);
    const db = await this.db();
    const { data, error } = await db
      .from("ai_messages")
      .insert({
        conversation_id: conversation.id,
        role: input.role,
        content: clean(input.content, "Message", 8000),
        proposed_action: input.proposedAction,
        action_status: input.proposedAction ? "pending" : null,
        medication_ids: input.medicationIds ?? [],
        source: input.source ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The message could not be saved.");
    return messageFrom(data as Row);
  }

  async clearConversation(actor: Actor): Promise<void> {
    if (!actor.patientId) throw new AccessError();
    const db = await this.db();
    const { data } = await db.from("ai_conversations").select("id").eq("patient_id", actor.patientId).maybeSingle();
    if (!data) return;
    const { error } = await db.from("ai_messages").delete().eq("conversation_id", text(data as Row, "id"));
    if (error) throw new ValidationError(error.message);
  }

  async resolveAction(actor: Actor, messageId: string, status: "confirmed" | "dismissed"): Promise<AiMessage> {
    const conversation = await this.getConversation(actor);
    const message = conversation.messages.find((item) => item.id === messageId);
    if (!message || !message.proposedAction) throw new AccessError("That request was not found.");
    if (message.actionStatus !== "pending") throw new ValidationError("This request was already reviewed.");
    const { data, error } = await (await this.db()).from("ai_messages").update({ action_status: status }).eq("id", messageId).select("*").single();
    if (error || !data) throw new ValidationError(error?.message ?? "The request could not be updated.");
    return messageFrom(data as Row);
  }

  async listNotifications(actor: Actor): Promise<AppNotification[]> {
    const { data } = await (await this.db()).from("notifications").select("*").eq("profile_id", actor.profileId).order("created_at", { ascending: false });
    return ((data ?? []) as Row[]).map(notificationFrom);
  }

  async markChatRead(actor: Actor, patientId: string): Promise<void> {
    const notes = await this.listNotifications(actor);
    const ids = notes
      .filter((note) => note.href && isUnreadChatNotice(note) && chatNoticeMatchesPatient(note.href, patientId))
      .map((note) => note.id);
    if (!ids.length) return;
    const { error } = await (await this.db()).from("notifications").update({ read: true }).in("id", ids).eq("profile_id", actor.profileId);
    if (error) throw new ValidationError(error.message);
  }

  async markRead(actor: Actor, id: string): Promise<void> {
    const { data, error } = await (await this.db()).from("notifications").update({ read: true }).eq("id", id).eq("profile_id", actor.profileId).select("id");
    if (error || !data?.length) throw new AccessError("That notification was not found.");
  }

  async markAllRead(actor: Actor): Promise<void> {
    const { error } = await (await this.db()).from("notifications").update({ read: true }).eq("profile_id", actor.profileId).eq("read", false);
    if (error) throw new AccessError();
  }

  async authorizeDoctor(actor: Actor, email: string): Promise<void> {
    if (actor.role !== "patient" || !actor.patientId) throw new AccessError();
    const admin = this.admin();
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email.trim().toLowerCase()).eq("role", "doctor").maybeSingle();
    if (!profile) throw new ValidationError("No clinician account uses that email. Nothing was shared.");
    const { data: doctor } = await admin.from("doctors").select("id").eq("profile_id", text(profile as Row, "id")).maybeSingle();
    if (!doctor) throw new ValidationError("That clinician record is incomplete.");
    const { error } = await (await this.db()).from("patient_doctors").upsert(
      {
        patient_id: actor.patientId,
        doctor_id: text(doctor as Row, "id"),
        status: "active",
        revoked_at: null,
        authorized_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,doctor_id" },
    );
    if (error) throw new ValidationError(error.message);
    await this.notify({
      profileId: text(profile as Row, "id"),
      kind: "app",
      title: "A patient authorized you",
      body: `${actor.fullName} authorized you to review their Senior Guardian record.`,
      href: `/doctor/patients/${actor.patientId}`,
    });
  }

  async revokeDoctor(actor: Actor, linkId: string): Promise<void> {
    const db = await this.db();
    const { data } = await db.from("patient_doctors").select("patient_id").eq("id", linkId).maybeSingle();
    if (!data || !canWriteOwnRecord(actor, text(data as Row, "patient_id"))) throw new AccessError();
    const { error } = await db.from("patient_doctors").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", linkId);
    if (error) throw new AccessError();
  }

  async inviteCaregiver(actor: Actor, email: string): Promise<void> {
    if (!actor.patientId) throw new AccessError();
    const admin = this.admin();
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email.trim().toLowerCase()).eq("role", "caregiver").maybeSingle();
    if (!profile) throw new ValidationError("No caregiver account uses that email. Nothing was shared.");
    const { data: caregiver } = await admin.from("caregivers").select("id").eq("profile_id", text(profile as Row, "id")).maybeSingle();
    if (!caregiver) throw new ValidationError("That caregiver record is incomplete.");
    const db = await this.db();
    const caregiverId = text(caregiver as Row, "id");
    const existing = await db.from("caregiver_permissions").select("id").eq("patient_id", actor.patientId).eq("caregiver_id", caregiverId).maybeSingle();
    const { error } = existing.data
      ? await db.from("caregiver_permissions").update({ status: "active", revoked_at: null }).eq("id", text(existing.data as Row, "id"))
      : await db.from("caregiver_permissions").insert({
          patient_id: actor.patientId,
          caregiver_id: caregiverId,
          view_medications: false,
          view_appointments: false,
          view_timeline: false,
          view_concerns: false,
          view_readings: false,
          manage_reminders: false,
          status: "active",
        });
    if (error) throw new ValidationError(error.message);
    await this.notify({
      profileId: text(profile as Row, "id"),
      kind: "caregiver",
      title: "A patient connected you",
      body: `${actor.fullName} connected you. No health information is shared until they turn a permission on.`,
      href: "/caregiver/dashboard",
    });
  }

  async updateCaregiverAccess(actor: Actor, permissionId: string, flags: PermissionFlags, revoke = false): Promise<void> {
    const db = await this.db();
    const { data: grant } = await db.from("caregiver_permissions").select("patient_id, caregiver_id").eq("id", permissionId).maybeSingle();
    if (!grant || !canWriteOwnRecord(actor, text(grant as Row, "patient_id"))) throw new AccessError();
    const caregiver = await db.from("caregivers").select("profile_id").eq("id", text(grant as Row, "caregiver_id")).maybeSingle();
    const { error } = await db
      .from("caregiver_permissions")
      .update({
        view_medications: flags.viewMedications,
        view_appointments: flags.viewAppointments,
        view_timeline: flags.viewTimeline,
        view_concerns: flags.viewConcerns,
        view_readings: flags.viewReadings,
        manage_reminders: flags.manageReminders,
        status: revoke ? "revoked" : "active",
        revoked_at: revoke ? new Date().toISOString() : null,
      })
      .eq("id", permissionId);
    if (error) throw new AccessError();
    if (caregiver.data) {
      await this.notify({
        profileId: text(caregiver.data as Row, "profile_id"),
        kind: "caregiver",
        title: "Sharing updated",
        body: revoke ? `${actor.fullName} revoked your access.` : `${actor.fullName} updated what you can see.`,
        href: "/caregiver/dashboard",
      });
    }
  }

  private async alarmState(actor: Actor, now: Date): Promise<{ due: DueAlarm[]; nextAt: string | null }> {
    const ctx = await this.context();
    const people =
      actor.role === "patient" && actor.patientId
        ? [{ patientId: actor.patientId, medications: true, appointments: true }]
        : actor.role === "caregiver"
          ? ctx.caregiverPermissions
              .filter((grant) => grant.status === "active" && grant.caregiverId === actor.caregiverId && (grant.manageReminders || grant.viewAppointments))
              .map((grant) => ({ patientId: grant.patientId, medications: grant.manageReminders, appointments: grant.viewAppointments }))
          : [];
    const db = await this.db();
    const { data: sent } = await db.from("notifications").select("alarm_key").eq("profile_id", actor.profileId).not("alarm_key", "is", null);
    const fired = new Set(((sent ?? []) as Row[]).map((row) => text(row, "alarm_key")));
    const due: DueAlarm[] = [];
    let nextAt: string | null = null;
    const day = localDate(now);
    for (const person of people) {
      const { profile } = await this.identity(person.patientId);
      const doses = person.medications ? await this.dosesFor(person.patientId, day) : [];
      const appointments = person.appointments
        ? (((await db.from("appointments").select("*").eq("patient_id", person.patientId)).data ?? []) as Row[]).map(appointmentFrom)
        : [];
      due.push(...selectDueAlarms({ patientId: person.patientId, patientName: profile.fullName, doses, appointments, fired, now }));
      const upcoming = nextAlarmAt({ doses, appointments, fired, now });
      if (upcoming && (!nextAt || upcoming < nextAt)) nextAt = upcoming;
    }
    return { due, nextAt };
  }

  private async dosesFor(patientId: string, day: string) {
    const db = await this.db();
    const { data: medications } = await db.from("medications").select("*").eq("patient_id", patientId).eq("status", "active");
    const { data: events } = await db.from("medication_events").select("medication_id, scheduled_for").eq("patient_id", patientId).eq("kind", "taken");
    return ((medications ?? []) as Row[]).map(medicationFrom).flatMap((medication) =>
      medication.times.map((time) => {
        const scheduledFor = atTime(day, time);
        const taken = ((events ?? []) as Row[]).some((event) => text(event, "medication_id") === medication.id && text(event, "scheduled_for") === scheduledFor);
        return { medication, time, scheduledFor, taken };
      }),
    );
  }

  async previewAlarms(actor: Actor, now = new Date()): Promise<{ due: DueAlarm[]; nextAt: string | null }> {
    return this.alarmState(actor, now);
  }

  async deliverAlarms(actor: Actor, drafts: AlarmDraft[], now = new Date()): Promise<DeliveredAlarm[]> {
    const open = new Set((await this.alarmState(actor, now)).due.map((item) => item.key));
    const created: DeliveredAlarm[] = [];
    const admin = this.admin();
    for (const draft of drafts) {
      if (!open.has(draft.key)) continue;
      const patient = (await admin.from("patients").select("id, profile_id").eq("id", draft.patientId).maybeSingle()).data as Row | null;
      if (!patient) continue;
      const patientProfileId = text(patient, "profile_id");
      const recipients = [patientProfileId];
      const flag = draft.kind === "medication" ? "manage_reminders" : "view_appointments";
      const { data: grants } = await admin.from("caregiver_permissions").select("caregiver_id, manage_reminders, view_appointments").eq("patient_id", draft.patientId).eq("status", "active");
      for (const grant of (grants ?? []) as Row[]) {
        if (!grant[flag]) continue;
        const caregiver = (await admin.from("caregivers").select("profile_id").eq("id", text(grant, "caregiver_id")).maybeSingle()).data as Row | null;
        if (caregiver) recipients.push(text(caregiver, "profile_id"));
      }
      if (!recipients.includes(actor.profileId)) continue;
      const patientName = text((await admin.from("profiles").select("full_name").eq("id", patientProfileId).single()).data as Row, "full_name");
      let patientIsNew = false;
      for (const profileId of recipients) {
        const existing = await admin.from("notifications").select("id").eq("profile_id", profileId).eq("alarm_key", draft.key).limit(1);
        if (existing.data && existing.data.length > 0) continue;
        const forPatient = profileId === patientProfileId;
        const title = forPatient ? draft.title : draft.caregiverTitle;
        const body = forPatient ? draft.body : `${patientName}: ${draft.body}`;
        const href = forPatient ? draft.patientHref : `/caregiver/patients/${draft.patientId}`;
        await this.notify({
          profileId,
          kind: draft.kind === "medication" ? "medication" : "appointment",
          title,
          body,
          href,
          alarmKey: draft.key,
        });
        if (forPatient) patientIsNew = true;
        if (profileId === actor.profileId) created.push({ key: draft.key, title, body, href });
      }
      if (patientIsNew) {
        let conversation = (await admin.from("ai_conversations").select("id").eq("patient_id", draft.patientId).maybeSingle()).data as Row | null;
        if (!conversation) {
          conversation = (await admin.from("ai_conversations").insert({ patient_id: draft.patientId, title: "Health assistant" }).select("id").single()).data as Row | null;
        }
        if (conversation) {
          await admin.from("ai_messages").insert({
            conversation_id: text(conversation, "id"),
            role: "assistant",
            content: clean(draft.body, "Message", 8000),
            medication_ids: draft.medicationId ? [draft.medicationId] : [],
            source: draft.source,
          });
        }
      }
    }
    return created;
  }

  private connectionFrom(row: Row, linked: boolean): DeviceConnection {
    return {
      id: text(row, "id"),
      patientId: text(row, "patient_id"),
      provider: text(row, "provider") as DeviceConnection["provider"],
      label: text(row, "label"),
      linked,
      createdAt: text(row, "created_at"),
    };
  }

  private async readingAudience(patientId: string): Promise<Array<{ profileId: string; href: string }>> {
    const admin = this.admin();
    const patient = await admin.from("patients").select("profile_id").eq("id", patientId).maybeSingle();
    if (!patient.data) return [];
    const people = [{ profileId: text(patient.data as Row, "profile_id"), href: "/patient/devices" }];
    const { data: grants } = await admin.from("caregiver_permissions").select("caregiver_id").eq("patient_id", patientId).eq("status", "active").eq("view_readings", true);
    for (const grant of (grants ?? []) as Row[]) {
      const caregiver = await admin.from("caregivers").select("profile_id").eq("id", text(grant, "caregiver_id")).maybeSingle();
      if (caregiver.data) people.push({ profileId: text(caregiver.data as Row, "profile_id"), href: `/caregiver/patients/${patientId}` });
    }
    const { data: links } = await admin.from("patient_doctors").select("doctor_id").eq("patient_id", patientId).eq("status", "active");
    for (const link of (links ?? []) as Row[]) {
      const doctor = await admin.from("doctors").select("profile_id").eq("id", text(link, "doctor_id")).maybeSingle();
      if (doctor.data) people.push({ profileId: text(doctor.data as Row, "profile_id"), href: `/doctor/patients/${patientId}` });
    }
    return people;
  }

  async getDeviceBoard(actor: Actor, patientId: string): Promise<DeviceBoard> {
    const ctx = await this.context();
    assertCan(canViewArea(actor, patientId, "readings", ctx));
    const db = await this.db();
    const [{ data: connections }, { data: ranges }, { data: readings }] = await Promise.all([
      db.from("device_connections").select("id, patient_id, provider, label, created_at").eq("patient_id", patientId).order("created_at"),
      db.from("reading_ranges").select("*").eq("patient_id", patientId),
      db.from("device_readings").select("*").eq("patient_id", patientId).order("recorded_at", { ascending: false }).limit(120),
    ]);
    const ids = ((connections ?? []) as Row[]).map((row) => text(row, "id"));
    const secrets = ids.length
      ? ((await this.admin().from("device_connection_secrets").select("connection_id").in("connection_id", ids)).data ?? [])
      : [];
    const linked = new Set((secrets as Row[]).map((row) => text(row, "connection_id")));
    return {
      connections: ((connections ?? []) as Row[]).map((row) => this.connectionFrom(row, linked.has(text(row, "id")))),
      ranges: ((ranges ?? []) as Row[]).map((row) => ({
        id: text(row, "id"),
        patientId,
        metric: text(row, "metric") as DeviceMetric,
        low: Number(row.low),
        high: Number(row.high),
      })),
      readings: ((readings ?? []) as Row[]).map((row) => ({
        id: text(row, "id"),
        patientId,
        connectionId: text(row, "connection_id"),
        metric: text(row, "metric") as DeviceMetric,
        value: Number(row.value),
        unit: text(row, "unit"),
        recordedAt: text(row, "recorded_at"),
        status: text(row, "status") as DeviceReading["status"],
      })),
    };
  }

  async connectDevice(actor: Actor, input: { provider: DeviceConnection["provider"]; label: string }): Promise<DeviceConnection> {
    if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
    if (!isProvider(input.provider)) throw new ValidationError("Choose a device.");
    const db = await this.db();
    const { data, error } = await db
      .from("device_connections")
      .insert({ patient_id: actor.patientId, provider: input.provider, label: clean(input.label, "Device name", 80) })
      .select("id, patient_id, provider, label, created_at")
      .single();
    if (error || !data) throw new ValidationError(error?.message || "The device could not be saved.");
    return this.connectionFrom(data as Row, false);
  }

  async saveReadingRange(actor: Actor, input: { metric: DeviceMetric; low: number; high: number }): Promise<void> {
    if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
    if (!isMetric(input.metric)) throw new ValidationError("Choose a reading.");
    const low = parseMetricNumber(input.metric, input.low);
    const high = parseMetricNumber(input.metric, input.high);
    if (low >= high) throw new ValidationError("The low end of the range has to be below the high end.");
    const db = await this.db();
    const { error } = await db.from("reading_ranges").upsert(
      { patient_id: actor.patientId, metric: input.metric, low, high },
      { onConflict: "patient_id,metric" },
    );
    if (error) throw new ValidationError(error.message);
  }

  async recordDeviceReading(
    actor: Actor,
    input: { connectionId: string; metric: DeviceMetric; value: number; recordedAt: string },
  ): Promise<DeviceReading> {
    if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
    if (!isMetric(input.metric)) throw new ValidationError("Choose a reading.");
    const db = await this.db();
    const { data: connection } = await db.from("device_connections").select("id, label").eq("id", input.connectionId).eq("patient_id", actor.patientId).maybeSingle();
    if (!connection) throw new ValidationError("Choose a connected device.");
    const value = parseMetricNumber(input.metric, input.value);
    const recordedAt = new Date(input.recordedAt);
    if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new ValidationError("Use a time that has already happened.");
    }
    const { data: rangeRow } = await db.from("reading_ranges").select("low, high").eq("patient_id", actor.patientId).eq("metric", input.metric).maybeSingle();
    const range = rangeRow ? { low: Number((rangeRow as Row).low), high: Number((rangeRow as Row).high) } : null;
    const judged = judgeReading(input.metric, value, range, text(connection as Row, "label"));
    const { data, error } = await db
      .from("device_readings")
      .insert({
        patient_id: actor.patientId,
        connection_id: input.connectionId,
        metric: input.metric,
        value,
        unit: METRICS[input.metric].unit,
        recorded_at: recordedAt.toISOString(),
        status: judged.status,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message || "The reading could not be saved.");
    const reading: DeviceReading = {
      id: text(data as Row, "id"),
      patientId: actor.patientId,
      connectionId: input.connectionId,
      metric: input.metric,
      value,
      unit: METRICS[input.metric].unit,
      recordedAt: recordedAt.toISOString(),
      status: judged.status,
    };
    if (judged.status === "outside") {
      for (const person of await this.readingAudience(actor.patientId)) {
        await this.notify({
          profileId: person.profileId,
          kind: "app",
          title: judged.title,
          body: judged.body,
          href: person.href,
          alarmKey: `reading:${reading.id}`,
        });
      }
    }
    return reading;
  }

  async linkDeviceAccount(actor: Actor, connectionId: string, secret: DeviceSecret): Promise<void> {
    if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
    const db = await this.db();
    const { data } = await db.from("device_connections").select("id").eq("id", connectionId).eq("patient_id", actor.patientId).maybeSingle();
    if (!data) throw new AccessError();
    const { error } = await this.admin().from("device_connection_secrets").upsert({
      connection_id: connectionId,
      access_token: secret.accessToken,
      refresh_token: secret.refreshToken,
      expires_at: secret.expiresAt,
    });
    if (error) throw new ValidationError("The device sign-in could not be saved.");
  }

  async readDeviceSecret(actor: Actor, connectionId: string): Promise<DeviceSecret | null> {
    if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
    const db = await this.db();
    const { data: connection } = await db.from("device_connections").select("id").eq("id", connectionId).eq("patient_id", actor.patientId).maybeSingle();
    if (!connection) throw new AccessError();
    const { data } = await this.admin().from("device_connection_secrets").select("access_token, refresh_token, expires_at").eq("connection_id", connectionId).maybeSingle();
    if (!data) return null;
    return {
      accessToken: text(data as Row, "access_token"),
      refreshToken: text(data as Row, "refresh_token"),
      expiresAt: text(data as Row, "expires_at"),
    };
  }

  async listCareMessages(actor: Actor, patientId: string): Promise<CareMessage[]> {
    const ctx = await this.context();
    assertCan(canKnowPatient(actor, patientId, ctx));
    const { data, error } = await this.admin().from("care_messages").select("*").eq("patient_id", patientId).order("created_at");
    if (error) throw new ValidationError(error.message);
    return ((data ?? []) as Row[]).map((row) => ({
      id: text(row, "id"),
      patientId: text(row, "patient_id"),
      authorId: text(row, "author_id"),
      authorName: text(row, "author_name"),
      authorRole: text(row, "author_role") as CareMessage["authorRole"],
      body: text(row, "body"),
      createdAt: text(row, "created_at"),
    }));
  }

  async postCareMessage(actor: Actor, patientId: string, body: string): Promise<CareMessage> {
    const ctx = await this.context();
    assertCan(canKnowPatient(actor, patientId, ctx));
    const messageBody = clean(body, "Message", 2000);
    const { data, error } = await this.admin()
      .from("care_messages")
      .insert({
        patient_id: patientId,
        author_id: actor.profileId,
        author_name: actor.fullName,
        author_role: actor.role,
        body: messageBody,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The message could not be sent.");
    const message: CareMessage = {
      id: text(data as Row, "id"),
      patientId,
      authorId: actor.profileId,
      authorName: actor.fullName,
      authorRole: actor.role,
      body: messageBody,
      createdAt: text(data as Row, "created_at"),
    };
    await this.notifyCareRecipients(message);
    return message;
  }

  /** Alerts the rest of the care team about a message the phone app already saved. */
  async notifyExistingCareMessage(authorId: string, messageId: string): Promise<void> {
    const { data, error } = await this.admin().from("care_messages").select("*").eq("id", messageId).maybeSingle();
    if (error || !data || text(data as Row, "author_id") !== authorId) throw new AccessError();
    const row = data as Row;
    await this.notifyCareRecipients({
      id: text(row, "id"),
      patientId: text(row, "patient_id"),
      authorId: text(row, "author_id"),
      authorName: text(row, "author_name"),
      authorRole: text(row, "author_role") as Role,
      body: text(row, "body"),
      createdAt: text(row, "created_at"),
    });
  }

  private async notifyCareRecipients(message: CareMessage): Promise<void> {
    const { patient } = await this.identity(message.patientId);
    const recipients = new Map<string, string>();
    if (patient.profileId !== message.authorId) recipients.set(patient.profileId, "/patient/chat");
    const { data: links } = await this.admin().from("patient_doctors").select("doctor_id").eq("patient_id", message.patientId).eq("status", "active");
    for (const link of (links ?? []) as Row[]) {
      const doctor = await this.admin().from("doctors").select("profile_id").eq("id", text(link, "doctor_id")).maybeSingle();
      const profileId = doctor.data ? text(doctor.data as Row, "profile_id") : "";
      if (profileId && profileId !== message.authorId) recipients.set(profileId, `/doctor/chat?patient=${message.patientId}`);
    }
    const { data: grants } = await this.admin().from("caregiver_permissions").select("caregiver_id").eq("patient_id", message.patientId).eq("status", "active");
    for (const grant of (grants ?? []) as Row[]) {
      const caregiver = await this.admin().from("caregivers").select("profile_id").eq("id", text(grant, "caregiver_id")).maybeSingle();
      const profileId = caregiver.data ? text(caregiver.data as Row, "profile_id") : "";
      if (profileId && profileId !== message.authorId) recipients.set(profileId, `/caregiver/chat?patient=${message.patientId}`);
    }
    for (const [profileId, href] of recipients) {
      await this.notify({
        profileId,
        kind: "doctor_message",
        title: `${message.authorName} sent a message`,
        body: message.body.slice(0, 180),
        href,
      });
    }
  }

  private clinicianMessage(row: Row): AiMessage {
    return {
      ...messageFrom({ ...row, conversation_id: row.thread_id, medication_ids: [] }),
      conversationId: text(row, "thread_id"),
    };
  }

  async getClinicianThread(actor: Actor) {
    if (actor.role !== "doctor" || !actor.doctorId) throw new AccessError("The clinician assistant is for an authorized clinician.");
    const admin = this.admin();
    let { data } = await admin.from("clinician_threads").select("*").eq("doctor_id", actor.doctorId).maybeSingle();
    if (!data) {
      const created = await admin.from("clinician_threads").insert({ doctor_id: actor.doctorId }).select("*").single();
      data = created.data;
      if (created.error || !data) throw new ValidationError(created.error?.message ?? "The assistant could not be opened.");
    }
    const threadId = text(data as Row, "id");
    const { data: messages, error } = await admin.from("clinician_messages").select("*").eq("thread_id", threadId).order("created_at");
    if (error) throw new ValidationError(error.message);
    return { id: threadId, messages: ((messages ?? []) as Row[]).map((row) => this.clinicianMessage(row)) };
  }

  async appendClinicianMessage(actor: Actor, input: NewMessage): Promise<AiMessage> {
    const thread = await this.getClinicianThread(actor);
    const { data, error } = await this.admin()
      .from("clinician_messages")
      .insert({
        thread_id: thread.id,
        role: input.role,
        content: clean(input.content, "Message", 8000),
        proposed_action: input.proposedAction,
        action_status: input.proposedAction ? "pending" : null,
        source: input.source ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The message could not be saved.");
    return this.clinicianMessage(data as Row);
  }

  async clearClinicianThread(actor: Actor): Promise<void> {
    if (!actor.doctorId) throw new AccessError();
    const { data } = await this.admin().from("clinician_threads").select("id").eq("doctor_id", actor.doctorId).maybeSingle();
    if (!data) return;
    const { error } = await this.admin().from("clinician_messages").delete().eq("thread_id", text(data as Row, "id"));
    if (error) throw new ValidationError(error.message);
  }

  private caregiverMessage(row: Row): AiMessage {
    return {
      id: text(row, "id"),
      conversationId: text(row, "thread_id"),
      role: text(row, "role") as AiMessage["role"],
      content: text(row, "content"),
      proposedAction: null,
      actionStatus: null,
      medicationIds: [],
      source: (row.source as AiMessage["source"]) ?? undefined,
      createdAt: text(row, "created_at"),
    };
  }

  async getCaregiverThread(actor: Actor) {
    if (actor.role !== "caregiver" || !actor.caregiverId) throw new AccessError("The caregiver assistant is for someone helping a shared record.");
    const admin = this.admin();
    let { data } = await admin.from("caregiver_threads").select("*").eq("caregiver_id", actor.caregiverId).maybeSingle();
    if (!data) {
      const created = await admin.from("caregiver_threads").insert({ caregiver_id: actor.caregiverId }).select("*").single();
      data = created.data;
      if (created.error || !data) throw new ValidationError(created.error?.message ?? "The assistant could not be opened.");
    }
    const threadId = text(data as Row, "id");
    const { data: messages, error } = await admin.from("caregiver_messages").select("*").eq("thread_id", threadId).order("created_at");
    if (error) throw new ValidationError(error.message);
    return { id: threadId, messages: ((messages ?? []) as Row[]).map((row) => this.caregiverMessage(row)) };
  }

  async appendCaregiverMessage(actor: Actor, input: NewMessage): Promise<AiMessage> {
    const thread = await this.getCaregiverThread(actor);
    const { data, error } = await this.admin()
      .from("caregiver_messages")
      .insert({
        thread_id: thread.id,
        role: input.role,
        content: clean(input.content, "Message", 8000),
        source: input.source ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The message could not be saved.");
    return this.caregiverMessage(data as Row);
  }

  async clearCaregiverThread(actor: Actor): Promise<void> {
    if (!actor.caregiverId) throw new AccessError();
    const { data } = await this.admin().from("caregiver_threads").select("id").eq("caregiver_id", actor.caregiverId).maybeSingle();
    if (!data) return;
    const { error } = await this.admin().from("caregiver_messages").delete().eq("thread_id", text(data as Row, "id"));
    if (error) throw new ValidationError(error.message);
  }

  async resolveClinicianAction(actor: Actor, messageId: string, status: "confirmed" | "dismissed"): Promise<AiMessage> {
    const thread = await this.getClinicianThread(actor);
    const message = thread.messages.find((item) => item.id === messageId);
    if (!message?.proposedAction) throw new AccessError("That request was not found.");
    if (message.actionStatus !== "pending") throw new ValidationError("This request was already reviewed.");
    const { data, error } = await this.admin().from("clinician_messages").update({ action_status: status }).eq("id", messageId).eq("thread_id", thread.id).select("*").single();
    if (error || !data) throw new ValidationError(error?.message ?? "The request could not be updated.");
    return this.clinicianMessage(data as Row);
  }

  async scheduleVisit(actor: Actor, patientId: string, input: AppointmentInput): Promise<Appointment> {
    if (actor.role !== "doctor") throw new AccessError("Only a clinician can schedule a visit this way.");
    const ctx = await this.context();
    assertCan(canKnowPatient(actor, patientId, ctx));
    const starts = new Date(input.startsAt);
    if (Number.isNaN(starts.getTime())) throw new ValidationError("Enter a valid date and time.");
    const admin = this.admin();
    const { data, error } = await admin
      .from("appointments")
      .insert({
        patient_id: patientId,
        provider: clean(input.provider, "Provider", 160),
        specialty: input.specialty.trim(),
        starts_at: starts.toISOString(),
        location: input.location.trim(),
        notes: input.notes.trim(),
        questions: input.questions.map((question) => question.trim()).filter(Boolean).slice(0, 20),
        reminder_enabled: input.reminderEnabled,
        status: "scheduled",
      })
      .select("*")
      .single();
    if (error || !data) throw new ValidationError(error?.message ?? "The visit could not be saved.");
    const appointment = appointmentFrom(data as Row);
    await admin.from("health_timeline").insert({
      patient_id: patientId,
      kind: "appointment",
      title: `Appointment with ${appointment.provider}`,
      summary: [appointment.specialty, appointment.location].filter(Boolean).join(" at "),
      source_label: `Scheduled by ${actor.fullName}`,
      ref_table: "appointments",
      ref_id: appointment.id,
    });
    const { patient } = await this.identity(patientId);
    await this.notify({
      profileId: patient.profileId,
      kind: "appointment",
      title: `Visit with ${appointment.provider}`,
      body: `${actor.fullName} added this visit. It is on your appointments page.`,
      href: `/patient/appointments/${appointment.id}`,
    });
    return appointment;
  }

  async resetDemo(): Promise<void> {
    throw new ValidationError("Restore is available for the local file store.");
  }
}
