import fs from "node:fs";
import path from "node:path";

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
  type AccessContext,
  ValidationError,
} from "@/lib/auth/access";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSeed, DEMO_VERSION, type DemoDatabase, type DemoProfile } from "@/lib/demo/seed";
import { IDS } from "@/lib/demo/ids";
import { isMetric, isProvider, judgeReading, METRICS, parseMetricNumber } from "@/lib/devices/metrics";
import { nextAlarmAt, selectDueAlarms, type AlarmDraft, type DeliveredAlarm, type DueAlarm } from "@/lib/alarms/due";
import { fanOut } from "@/lib/notifications/channels";
import { chatNoticeMatchesPatient, isUnreadChatNotice } from "@/lib/notifications/chat";
import { reminderBlockReason, reminderCountReason } from "@/lib/medications/schedule";
import { atTime, formatTime, localDate } from "@/lib/time";
import type {
  Actor,
  AiMessage,
  CareMessage,
  AppNotification,
  Appointment,
  DeviceConnection,
  DeviceReading,
  DoctorNote,
  HealthConcern,
  Medication,
  MedicationEvent,
  Patient,
  Profile,
  TimelineEvent,
  TimelineKind,
} from "@/types/domain";
import type {
  AppointmentInput,
  ClinicianDocumentInput,
  DocumentInput,
  DeviceBoard,
  DeviceSecret,
  HealthPatch,
  HealthStore,
  MedicationInput,
  NewMessage,
  PatientCard,
  PatientChart,
  PermissionFlags,
  ProfilePatch,
  ScheduledVisit,
  SignupInput,
  TodayDose,
  UploadInput,
} from "@/lib/data/types";
import type { HealthDocument } from "@/types/domain";

function pub(profile: DemoProfile): Profile {
  const { passwordHash: _password, ...rest } = profile;
  return rest;
}

function clean(value: string, label: string, max = 4000): string {
  const text = value.trim();
  if (!text) throw new ValidationError(`${label} is required.`);
  if (text.length > max) throw new ValidationError(`${label} is too long.`);
  return text;
}

function emailOf(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Enter a valid email address.");
  }
  return email;
}

function cleanTimes(times: string[]): string[] {
  const unique = [...new Set(times.map((time) => time.trim()).filter(Boolean))].sort();
  for (const time of unique) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new ValidationError("Use reminder times like 08:00 or 18:30.");
    }
  }
  return unique;
}

function flagsOf(grant: PermissionFlags): PermissionFlags {
  return {
    viewMedications: grant.viewMedications,
    viewAppointments: grant.viewAppointments,
    viewTimeline: grant.viewTimeline,
    viewConcerns: grant.viewConcerns,
    viewReadings: grant.viewReadings,
    manageReminders: grant.manageReminders,
  };
}

export class FileHealthStore implements HealthStore {
  private db: DemoDatabase | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly dir: string) {}

  private enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private filePath(): string {
    return path.join(this.dir, "records.txt");
  }

  private load(): DemoDatabase {
    if (this.db) return this.db;
    fs.mkdirSync(this.dir, { recursive: true });
    const file = this.filePath();
    const legacy = path.join(this.dir, "db.json");
    const source = fs.existsSync(file) ? file : fs.existsSync(legacy) ? legacy : null;
    if (source) {
      const saved = JSON.parse(fs.readFileSync(source, "utf8")) as DemoDatabase;
      if (saved.version === DEMO_VERSION) {
        const missingDevices = !Array.isArray(saved.deviceConnections);
        saved.deviceConnections ??= [];
        saved.deviceSecrets ??= [];
        saved.readingRanges ??= [];
        saved.deviceReadings ??= [];
        saved.careMessages ??= [];
        saved.clinicianThreads ??= [];
        saved.clinicianMessages ??= [];
        saved.caregiverThreads ??= [];
        saved.caregiverMessages ??= [];
        for (const profile of saved.profiles) {
          if (profile.locale !== "en" && profile.locale !== "es") profile.locale = "en";
        }
        for (const grant of saved.caregiverPermissions) {
          if (typeof grant.viewReadings !== "boolean") grant.viewReadings = grant.id === IDS.caregiverGrant;
        }
        this.db = saved;
        const preview = createSeed().db;
        let addedRobert = false;
        if (!saved.patients.some((patient) => patient.id === IDS.robertPatient)) {
          addedRobert = true;
          const profile = preview.profiles.find((item) => item.id === IDS.robertProfile);
          if (profile && !saved.profiles.some((item) => item.id === profile.id)) saved.profiles.push(profile);
          const patient = preview.patients.find((item) => item.id === IDS.robertPatient);
          if (patient) saved.patients.push(patient);
          for (const row of preview.patientDoctors) {
            if (row.patientId === IDS.robertPatient) saved.patientDoctors.push(row);
          }
          for (const row of preview.caregiverPermissions) {
            if (row.patientId === IDS.robertPatient) saved.caregiverPermissions.push(row);
          }
          for (const row of preview.medications) {
            if (row.patientId === IDS.robertPatient) saved.medications.push(row);
          }
          for (const row of preview.prescriptions) {
            if (row.patientId === IDS.robertPatient) saved.prescriptions.push(row);
          }
          for (const row of preview.appointments) {
            if (row.patientId === IDS.robertPatient) saved.appointments.push(row);
          }
          for (const row of preview.doctorNotes) {
            if (row.patientId === IDS.robertPatient) saved.doctorNotes.push(row);
          }
          for (const row of preview.timeline) {
            if (row.patientId === IDS.robertPatient) saved.timeline.push(row);
          }
          for (const row of preview.careMessages) {
            if (row.patientId === IDS.robertPatient) saved.careMessages.push(row);
          }
        }
        if (missingDevices) {
          saved.deviceConnections = preview.deviceConnections;
          saved.deviceSecrets = preview.deviceSecrets;
          saved.readingRanges = preview.readingRanges;
          saved.deviceReadings = preview.deviceReadings;
          for (const note of preview.notifications) {
            if (note.alarmKey?.startsWith("reading:") && !saved.notifications.some((item) => item.alarmKey === note.alarmKey && item.profileId === note.profileId)) {
              saved.notifications.push(note);
            }
          }
        }
        if (source !== file || missingDevices || addedRobert) this.persist();
        return this.db;
      }
    }
    const seed = createSeed();
    this.db = seed.db;
    this.persist();
    for (const item of seed.files) this.writeBytes(item.id, item.data);
    return this.db;
  }

  private persist(): void {
    if (!this.db) return;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.filePath(), `${JSON.stringify(this.db, null, 2)}\n`);
    const legacy = path.join(this.dir, "db.json");
    if (legacy !== this.filePath() && fs.existsSync(legacy)) fs.unlinkSync(legacy);
  }

  private writeBytes(id: string, data: Buffer): void {
    const folder = path.join(this.dir, "files");
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, id), data);
  }

  private context(db: DemoDatabase): AccessContext {
    return { patientDoctors: db.patientDoctors, caregiverPermissions: db.caregiverPermissions };
  }

  private profileById(db: DemoDatabase, id: string): DemoProfile {
    const profile = db.profiles.find((item) => item.id === id);
    if (!profile) throw new AccessError("This account is not available.");
    return profile;
  }

  private toActor(db: DemoDatabase, profile: DemoProfile): Actor {
    return {
      profileId: profile.id,
      role: profile.role,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone,
      textScale: profile.textScale,
      locale: profile.locale === "es" ? "es" : "en",
      patientId: db.patients.find((item) => item.profileId === profile.id)?.id ?? null,
      doctorId: db.doctors.find((item) => item.profileId === profile.id)?.id ?? null,
      caregiverId: db.caregivers.find((item) => item.profileId === profile.id)?.id ?? null,
    };
  }

  private patientOf(db: DemoDatabase, patientId: string): Patient {
    const patient = db.patients.find((item) => item.id === patientId);
    if (!patient) throw new AccessError("That health record was not found.");
    return patient;
  }

  private know(actor: Actor, patientId: string, db: DemoDatabase): void {
    assertCan(canKnowPatient(actor, patientId, this.context(db)));
  }

  private view(actor: Actor, patientId: string, area: Parameters<typeof canViewArea>[2], db: DemoDatabase): void {
    assertCan(canViewArea(actor, patientId, area, this.context(db)));
  }

  private notify(db: DemoDatabase, input: Omit<AppNotification, "id" | "read" | "createdAt">): void {
    db.notifications.push({
      ...input,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    });
    void fanOut(input);
  }

  private timeline(
    db: DemoDatabase,
    input: Omit<TimelineEvent, "id" | "createdAt"> & { createdAt?: string },
  ): void {
    db.timeline.push({
      id: crypto.randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      patientId: input.patientId,
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      sourceLabel: input.sourceLabel,
      refTable: input.refTable,
      refId: input.refId,
    });
  }

  private visibleEvent(actor: Actor, event: TimelineEvent, db: DemoDatabase): boolean {
    const area: Record<TimelineKind, Parameters<typeof canViewArea>[2]> = {
      concern: "concerns",
      image: "concerns",
      medication_change: "medications",
      medication_activity: "medications",
      appointment: "appointments",
      doctor_note: "notes",
      patient_note: "notes",
      document: "documents",
      ai_summary: "timeline",
    };
    if (!canViewArea(actor, event.patientId, area[event.kind], this.context(db))) return false;
    if (actor.role === "patient" || (event.kind !== "concern" && event.kind !== "image")) return true;
    return db.healthConcerns.some((item) => item.id === event.refId && item.sharedWithCareTeam);
  }

  async verifyCredentials(email: string, password: string): Promise<Profile | null> {
    return this.enqueue(() => {
      const db = this.load();
      const profile = db.profiles.find((item) => item.email === email.trim().toLowerCase());
      if (!profile || !verifyPassword(password, profile.passwordHash)) return null;
      return pub(profile);
    });
  }

  async createAccount(input: SignupInput): Promise<Profile> {
    return this.enqueue(() => {
      const db = this.load();
      const email = emailOf(input.email);
      if (input.password.length < 8) throw new ValidationError("Use a password with at least 8 characters.");
      if (db.profiles.some((item) => item.email === email)) {
        throw new ValidationError("An account with that email already exists.");
      }
      const now = new Date().toISOString();
      const profile: DemoProfile = {
        id: crypto.randomUUID(),
        email,
        passwordHash: hashPassword(input.password),
        role: input.role,
        fullName: clean(input.fullName, "Name", 120),
        phone: input.phone?.trim() ?? "",
        textScale: "default",
        locale: "en",
        createdAt: now,
        updatedAt: now,
      };
      db.profiles.push(profile);
      if (input.role === "patient") {
        db.patients.push({
          id: crypto.randomUUID(),
          profileId: profile.id,
          dateOfBirth: input.dateOfBirth?.trim() || "",
          address: "",
          emergencyContact: "",
          bloodType: "",
          allergies: "",
          conditions: "",
          fictional: false,
          createdAt: now,
          updatedAt: now,
        });
      } else if (input.role === "doctor") {
        db.doctors.push({
          id: crypto.randomUUID(),
          profileId: profile.id,
          specialty: input.specialty?.trim() || "Clinician",
          clinic: input.clinic?.trim() || "",
          fictional: false,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        db.caregivers.push({
          id: crypto.randomUUID(),
          profileId: profile.id,
          relationship: input.relationship?.trim() || "Caregiver",
          fictional: false,
          createdAt: now,
          updatedAt: now,
        });
      }
      this.persist();
      return pub(profile);
    });
  }

  async getActor(profileId: string): Promise<Actor | null> {
    return this.enqueue(() => {
      const db = this.load();
      const profile = db.profiles.find((item) => item.id === profileId);
      return profile ? this.toActor(db, profile) : null;
    });
  }

  async updateProfile(actor: Actor, patch: ProfilePatch): Promise<Profile> {
    return this.enqueue(() => {
      const db = this.load();
      const profile = this.profileById(db, actor.profileId);
      if (patch.fullName !== undefined) profile.fullName = clean(patch.fullName, "Name", 120);
      if (patch.phone !== undefined) profile.phone = patch.phone.trim();
      if (patch.textScale) profile.textScale = patch.textScale;
      if (patch.locale === "en" || patch.locale === "es") profile.locale = patch.locale;
      profile.updatedAt = new Date().toISOString();
      this.persist();
      return pub(profile);
    });
  }

  async updateHealthProfile(actor: Actor, patch: HealthPatch): Promise<Patient> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId) throw new AccessError();
      assertCan(canWriteOwnRecord(actor, actor.patientId));
      const patient = this.patientOf(db, actor.patientId);
      const field = (value: string, max = 600) => {
        const text = value.trim();
        if (text.length > max) throw new ValidationError("One of the answers is too long.");
        return text;
      };
      if (patch.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dateOfBirth)) {
        throw new ValidationError("Enter the date of birth as a date.");
      }
      patient.dateOfBirth = patch.dateOfBirth;
      patient.address = field(patch.address, 240);
      patient.emergencyContact = field(patch.emergencyContact, 240);
      patient.bloodType = field(patch.bloodType, 12);
      patient.allergies = field(patch.allergies);
      patient.conditions = field(patch.conditions);
      patient.updatedAt = new Date().toISOString();
      this.persist();
      return patient;
    });
  }

  async listPatientCards(actor: Actor): Promise<PatientCard[]> {
    return this.enqueue(() => {
      const db = this.load();
      const ids = new Set<string>();
      if (actor.role === "patient" && actor.patientId) ids.add(actor.patientId);
      if (actor.role === "doctor" && actor.doctorId) {
        for (const link of db.patientDoctors) {
          if (link.doctorId === actor.doctorId && link.status === "active") ids.add(link.patientId);
        }
      }
      if (actor.role === "caregiver" && actor.caregiverId) {
        for (const grant of db.caregiverPermissions) {
          if (grant.caregiverId === actor.caregiverId && grant.status === "active") ids.add(grant.patientId);
        }
      }
      return [...ids].map((patientId) => this.card(db, actor, patientId));
    });
  }

  private card(db: DemoDatabase, actor: Actor, patientId: string): PatientCard {
    const ctx = this.context(db);
    const patient = this.patientOf(db, patientId);
    const profile = this.profileById(db, patient.profileId);
    const next = db.appointments
      .filter((item) => item.patientId === patientId && item.status === "scheduled" && item.startsAt >= new Date().toISOString())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    const grant = db.caregiverPermissions.find(
      (item) => item.patientId === patientId && item.caregiverId === actor.caregiverId && item.status === "active",
    );
    const seeConcerns = canViewArea(actor, patientId, "concerns", ctx);
    const concerns = seeConcerns
      ? db.healthConcerns
          .filter((item) => item.patientId === patientId && (actor.role === "patient" || item.sharedWithCareTeam))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : [];
    const latest = concerns[0];
    const lastActivity = db.timeline
      .filter((event) => event.patientId === patientId && this.visibleEvent(actor, event, db))
      .reduce<string | null>((max, event) => (!max || event.createdAt > max ? event.createdAt : max), null);
    const isCaregiver = actor.role === "caregiver";
    return {
      patientId,
      fullName: profile.fullName,
      fictional: patient.fictional,
      dateOfBirth: patient.dateOfBirth,
      conditions: isCaregiver ? "" : patient.conditions,
      allergies: isCaregiver && !grant?.viewMedications ? "" : patient.allergies,
      nextAppointment: canViewArea(actor, patientId, "appointments", ctx) ? next?.startsAt ?? null : null,
      concernCount: concerns.length,
      activeMedicationCount: canViewArea(actor, patientId, "medications", ctx)
        ? db.medications.filter((item) => item.patientId === patientId && item.status === "active").length
        : null,
      latestConcern: latest
        ? {
            id: latest.id,
            description: latest.description,
            urgency: latest.analysis?.urgency ?? null,
            createdAt: latest.createdAt,
          }
        : null,
      lastActivity,
      access: isCaregiver && grant ? flagsOf(grant) : "full",
    };
  }

  async getChart(actor: Actor, patientId: string): Promise<PatientChart> {
    return this.enqueue(() => {
      const db = this.load();
      this.know(actor, patientId, db);
      const ctx = this.context(db);
      const fullRecord = actor.role !== "caregiver" || canViewArea(actor, patientId, "overview", ctx);
      const source = this.patientOf(db, patientId);
      const patient = fullRecord
        ? source
        : { ...source, address: "", emergencyContact: "", bloodType: "", allergies: "", conditions: "" };
      const profile = pub(this.profileById(db, patient.profileId));
      const see = (area: Parameters<typeof canViewArea>[2]) => canViewArea(actor, patientId, area, ctx);
      const notes = see("notes")
        ? db.doctorNotes
            .filter((note) => note.patientId === patientId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((note) => ({
              ...note,
              authorName: this.authorName(db, note.doctorId),
            }))
        : null;
      return {
        patient,
        profile,
        medications: see("medications") ? db.medications.filter((item) => item.patientId === patientId) : null,
        medicationEvents: see("medications") ? db.medicationEvents.filter((item) => item.patientId === patientId) : null,
        appointments: see("appointments") ? db.appointments.filter((item) => item.patientId === patientId) : null,
        concerns: see("concerns")
          ? db.healthConcerns.filter(
              (item) => item.patientId === patientId && (actor.role === "patient" || item.sharedWithCareTeam),
            )
          : null,
        timeline: db.timeline
          .filter((event) => event.patientId === patientId && this.visibleEvent(actor, event, db))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        documents: see("documents") ? db.documents.filter((item) => item.patientId === patientId) : null,
        prescriptions: see("medications") ? db.prescriptions.filter((item) => item.patientId === patientId) : null,
        notes,
        careTeam: canWriteOwnRecord(actor, patientId) ? this.careTeam(db, patientId) : null,
        canManageReminders: canManageReminders(actor, patientId, ctx),
        access: (() => {
          const grant = actor.role === "caregiver"
            ? db.caregiverPermissions.find((item) => item.patientId === patientId && item.caregiverId === actor.caregiverId && item.status === "active")
            : undefined;
          return grant ? flagsOf(grant) : "full";
        })(),
      };
    });
  }

  private authorName(db: DemoDatabase, doctorId: string): string {
    const doctor = db.doctors.find((item) => item.id === doctorId);
    const profile = doctor ? db.profiles.find((item) => item.id === doctor.profileId) : undefined;
    return profile ? profile.fullName : "Clinician";
  }

  private careTeam(db: DemoDatabase, patientId: string): PatientChart["careTeam"] {
    return {
      doctors: db.patientDoctors
        .filter((link) => link.patientId === patientId)
        .map((link) => {
          const doctor = db.doctors.find((item) => item.id === link.doctorId);
          const profile = doctor ? db.profiles.find((item) => item.id === doctor.profileId) : undefined;
          return {
            linkId: link.id,
            name: profile?.fullName ?? "Clinician",
            email: profile?.email ?? "",
            specialty: doctor?.specialty ?? "",
            clinic: doctor?.clinic ?? "",
            status: link.status,
            authorizedAt: link.authorizedAt,
          };
        }),
      caregivers: db.caregiverPermissions
        .filter((grant) => grant.patientId === patientId)
        .map((grant) => {
          const caregiver = db.caregivers.find((item) => item.id === grant.caregiverId);
          const profile = caregiver ? db.profiles.find((item) => item.id === caregiver.profileId) : undefined;
          return {
            permissionId: grant.id,
            name: profile?.fullName ?? "Caregiver",
            email: profile?.email ?? "",
            relationship: caregiver?.relationship ?? "",
            status: grant.status,
            flags: flagsOf(grant),
          };
        }),
    };
  }

  private dosesOn(db: DemoDatabase, patientId: string, day: string): TodayDose[] {
    return db.medications
      .filter((med) => med.patientId === patientId && med.status === "active")
      .flatMap((medication) =>
        medication.times.map((time) => {
          const scheduledFor = atTime(day, time);
          const taken = db.medicationEvents.some(
            (event) => event.medicationId === medication.id && event.kind === "taken" && event.scheduledFor === scheduledFor,
          );
          return { medication, time, scheduledFor, taken };
        }),
      );
  }

  async todayDoses(actor: Actor, patientId: string): Promise<TodayDose[]> {
    return this.enqueue(() => {
      const db = this.load();
      this.view(actor, patientId, "medications", db);
      return this.dosesOn(db, patientId, localDate());
    });
  }

  async getMedication(actor: Actor, id: string) {
    return this.enqueue(() => {
      const db = this.load();
      const medication = db.medications.find((item) => item.id === id);
      if (!medication) throw new AccessError("That medication was not found.");
      this.view(actor, medication.patientId, "medications", db);
      return {
        medication,
        prescription: db.prescriptions.find((item) => item.id === medication.prescriptionId) ?? null,
        events: db.medicationEvents.filter((item) => item.medicationId === id),
      };
    });
  }

  async saveMedication(actor: Actor, input: MedicationInput, id?: string): Promise<Medication> {
    return this.enqueue(() => {
      const db = this.load();
      const now = new Date().toISOString();
      const times = cleanTimes(input.times);
      const tooMany = reminderCountReason(input.instructions, input.frequency, times);
      if (tooMany) throw new ValidationError(tooMany);
      const next = {
        name: clean(input.name, "Medication name", 160),
        instructions: clean(input.instructions, "Prescription instructions"),
        frequency: clean(input.frequency, "How often", 160),
        times,
        startDate: input.startDate || localDate(),
        endDate: input.endDate,
        prescribingProvider: input.prescribingProvider.trim(),
        notes: input.notes.trim(),
        reminderEnabled: input.reminderEnabled,
      };
      let labelFileId: string | null = null;
      if (input.labelFileId) {
        const file = db.files.find((item) => item.id === input.labelFileId);
        if (!file || file.patientId !== actor.patientId || file.bucket !== "prescriptions") {
          throw new AccessError("That label photo is not in this record.");
        }
        labelFileId = file.id;
      }
      if (!id) {
        if (!actor.patientId) throw new AccessError();
        assertCan(canWriteOwnRecord(actor, actor.patientId));
        const medication: Medication = {
          ...next,
          id: crypto.randomUUID(),
          patientId: actor.patientId,
          prescriptionId: crypto.randomUUID(),
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        db.medications.push(medication);
        db.prescriptions.push({
          id: medication.prescriptionId!,
          patientId: actor.patientId,
          medicationId: medication.id,
          title: medication.name,
          sourceText: medication.instructions,
          fileId: labelFileId,
          aiExplanation: null,
          createdAt: now,
          updatedAt: now,
        });
        db.medicationEvents.push({
          id: crypto.randomUUID(),
          medicationId: medication.id,
          patientId: actor.patientId,
          kind: "added",
          scheduledFor: null,
          note: "Medication added by the patient.",
          createdAt: now,
        });
        this.timeline(db, {
          patientId: actor.patientId,
          kind: "medication_change",
          title: `Medication added: ${medication.name}`,
          summary: medication.instructions,
          sourceLabel: "Entered by the patient from prescription information",
          refTable: "medications",
          refId: medication.id,
        });
        this.persist();
        return medication;
      }
      const current = db.medications.find((item) => item.id === id);
      if (!current) throw new AccessError("That medication was not found.");
      const own = canWriteOwnRecord(actor, current.patientId);
      assertCan(canRevisePrescription(actor, current.patientId, this.context(db)), "Only the patient or their clinician can change this prescription.");
      const previousInstructions = current.instructions;
      Object.assign(current, next, { updatedAt: now });
      const prescription = db.prescriptions.find((item) => item.id === current.prescriptionId);
      if (prescription) {
        if (prescription.sourceText !== current.instructions) prescription.aiExplanation = null;
        prescription.sourceText = current.instructions;
        prescription.title = current.name;
        if (labelFileId) prescription.fileId = labelFileId;
        prescription.updatedAt = now;
      }
      db.medicationEvents.push({
        id: crypto.randomUUID(),
        medicationId: current.id,
        patientId: current.patientId,
        kind: "updated",
        scheduledFor: null,
        note: own ? "Patient updated the saved prescription information." : `${actor.fullName} updated the saved prescription. The assistant did not write this change.`,
        createdAt: now,
      });
      this.timeline(db, {
        patientId: current.patientId,
        kind: "medication_change",
        title: `Medication updated: ${current.name}`,
        summary: previousInstructions !== current.instructions ? `Now: ${current.instructions}\n\nPreviously: ${previousInstructions}` : current.instructions,
        sourceLabel: own
          ? "Updated by the patient. The AI did not change this text."
          : `Updated by ${actor.fullName}. The previous prescription text stays in this note. The assistant did not write this change.`,
        refTable: "medications",
        refId: current.id,
      });
      if (!own) {
        const patient = this.patientOf(db, current.patientId);
        this.notify(db, {
          profileId: patient.profileId,
          kind: "medication",
          title: `Prescription updated: ${current.name}`,
          body: `${actor.fullName} updated the saved prescription. It now says: ${current.instructions}`,
          href: `/patient/medications/${current.id}`,
        });
      }
      this.persist();
      return current;
    });
  }

  async archiveMedication(actor: Actor, id: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const medication = db.medications.find((item) => item.id === id);
      if (!medication) throw new AccessError("That medication was not found.");
      assertCan(canWriteOwnRecord(actor, medication.patientId));
      medication.status = "archived";
      medication.updatedAt = new Date().toISOString();
      this.timeline(db, {
        patientId: medication.patientId,
        kind: "medication_change",
        title: `Medication archived: ${medication.name}`,
        summary: "The patient archived this medication. The original instructions are still saved.",
        sourceLabel: "Changed by the patient",
        refTable: "medications",
        refId: medication.id,
      });
      this.persist();
    });
  }

  async markTaken(actor: Actor, medicationId: string, time: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const medication = db.medications.find((item) => item.id === medicationId);
      if (!medication) throw new AccessError("That medication was not found.");
      const own = canWriteOwnRecord(actor, medication.patientId);
      assertCan(own || canManageReminders(actor, medication.patientId, this.context(db)));
      const [cleanTime] = cleanTimes([time]);
      if (!cleanTime) throw new ValidationError("Choose a reminder time.");
      const scheduledFor = atTime(localDate(), cleanTime);
      if (db.medicationEvents.some((event) => event.medicationId === medicationId && event.kind === "taken" && event.scheduledFor === scheduledFor)) {
        return;
      }
      const now = new Date().toISOString();
      db.medicationEvents.push({
        id: crypto.randomUUID(),
        medicationId,
        patientId: medication.patientId,
        kind: "taken",
        scheduledFor,
        note: own ? "Marked taken by the patient." : `Marked taken by ${actor.fullName} (caregiver).`,
        createdAt: now,
      });
      this.timeline(db, {
        patientId: medication.patientId,
        kind: "medication_activity",
        title: `Taken: ${medication.name}`,
        summary: `Marked taken for ${formatTime(cleanTime)}. Instructions remain: ${medication.instructions}`,
        sourceLabel: own ? "Recorded by the patient" : `Recorded by ${actor.fullName}, caregiver`,
        refTable: "medications",
        refId: medication.id,
      });
      this.persist();
    });
  }

  async setReminder(actor: Actor, medicationId: string, time: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const medication = db.medications.find((item) => item.id === medicationId);
      if (!medication) throw new AccessError("That medication was not found.");
      assertCan(canManageReminders(actor, medication.patientId, this.context(db)), "You cannot change reminders for this person.");
      const [cleanTime] = cleanTimes([time]);
      if (!cleanTime) throw new ValidationError("Choose a reminder time.");
      const blocked = reminderBlockReason(medication, cleanTime);
      if (blocked) throw new ValidationError(blocked);
      medication.times.push(cleanTime);
      medication.times.sort();
      medication.reminderEnabled = true;
      medication.updatedAt = new Date().toISOString();
      const instructions = medication.instructions;
      db.medicationEvents.push({
        id: crypto.randomUUID(),
        medicationId,
        patientId: medication.patientId,
        kind: "reminder_set",
        scheduledFor: null,
        note: `Reminder saved for ${formatTime(cleanTime)}. Prescription instructions were not changed.`,
        createdAt: medication.updatedAt,
      });
      this.notify(db, {
        profileId: this.profileById(db, this.patientOf(db, medication.patientId).profileId).id,
        kind: "medication",
        title: `Reminder for ${medication.name}`,
        body: `A reminder was saved for ${formatTime(cleanTime)}. The prescription still says: ${instructions}`,
        href: `/patient/medications/${medication.id}`,
      });
      this.persist();
      if (medication.instructions !== instructions) throw new ValidationError("The prescription text changed unexpectedly.");
    });
  }

  async getAppointment(actor: Actor, id: string): Promise<Appointment> {
    return this.enqueue(() => {
      const db = this.load();
      const appointment = db.appointments.find((item) => item.id === id);
      if (!appointment) throw new AccessError("That appointment was not found.");
      this.view(actor, appointment.patientId, "appointments", db);
      return appointment;
    });
  }

  async saveAppointment(actor: Actor, input: AppointmentInput, id?: string): Promise<Appointment> {
    return this.enqueue(() => {
      const db = this.load();
      const starts = new Date(input.startsAt);
      if (Number.isNaN(starts.getTime())) throw new ValidationError("Enter a valid date and time.");
      const now = new Date().toISOString();
      const fields = {
        provider: clean(input.provider, "Provider", 160),
        specialty: input.specialty.trim(),
        startsAt: starts.toISOString(),
        location: input.location.trim(),
        notes: input.notes.trim(),
        questions: input.questions.map((question) => question.trim()).filter(Boolean).slice(0, 20),
        reminderEnabled: input.reminderEnabled,
        updatedAt: now,
      };
      if (!id) {
        if (!actor.patientId) throw new AccessError();
        assertCan(canWriteOwnRecord(actor, actor.patientId));
        const appointment: Appointment = {
          ...fields,
          id: crypto.randomUUID(),
          patientId: actor.patientId,
          status: "scheduled",
          createdAt: now,
        };
        db.appointments.push(appointment);
        this.timeline(db, {
          patientId: actor.patientId,
          kind: "appointment",
          title: `Appointment with ${appointment.provider}`,
          summary: `${appointment.specialty} at ${appointment.location}`,
          sourceLabel: "Saved by the patient",
          refTable: "appointments",
          refId: appointment.id,
        });
        if (appointment.reminderEnabled) {
          this.notify(db, {
            profileId: actor.profileId,
            kind: "appointment",
            title: `Visit with ${appointment.provider}`,
            body: "An appointment reminder was saved.",
            href: `/patient/appointments/${appointment.id}`,
          });
        }
        this.persist();
        return appointment;
      }
      const current = db.appointments.find((item) => item.id === id);
      if (!current) throw new AccessError("That appointment was not found.");
      assertCan(canWriteOwnRecord(actor, current.patientId));
      Object.assign(current, fields);
      this.persist();
      return current;
    });
  }

  async archiveAppointment(actor: Actor, id: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const appointment = db.appointments.find((item) => item.id === id);
      if (!appointment) throw new AccessError("That appointment was not found.");
      assertCan(canWriteOwnRecord(actor, appointment.patientId));
      appointment.status = "archived";
      appointment.updatedAt = new Date().toISOString();
      this.persist();
    });
  }

  async listSchedule(actor: Actor): Promise<ScheduledVisit[]> {
    return this.enqueue(() => {
      const db = this.load();
      return db.appointments
        .filter((item) => item.status !== "archived" && canViewArea(actor, item.patientId, "appointments", this.context(db)))
        .map((item) => {
          const patient = this.patientOf(db, item.patientId);
          const profile = this.profileById(db, patient.profileId);
          return { ...item, patientName: profile.fullName };
        })
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    });
  }

  async getConcern(actor: Actor, id: string): Promise<HealthConcern> {
    return this.enqueue(() => {
      const db = this.load();
      const concern = db.healthConcerns.find((item) => item.id === id);
      if (!concern) throw new AccessError("That health concern was not found.");
      this.view(actor, concern.patientId, "concerns", db);
      if (actor.role !== "patient" && !concern.sharedWithCareTeam) {
        throw new AccessError("This concern has not been shared with the care team.");
      }
      return concern;
    });
  }

  async createConcern(
    actor: Actor,
    input: { patientId: string; description: string; imageFileId: string | null; analysis: HealthConcern["analysis"]; sharedWithCareTeam: boolean },
  ): Promise<HealthConcern> {
    return this.enqueue(() => {
      const db = this.load();
      assertCan(canWriteOwnRecord(actor, input.patientId));
      if (input.imageFileId) {
        const file = db.files.find((item) => item.id === input.imageFileId);
        if (!file || file.patientId !== input.patientId) throw new AccessError("That image is not in this record.");
      }
      const now = new Date().toISOString();
      const concern: HealthConcern = {
        id: crypto.randomUUID(),
        patientId: input.patientId,
        description: clean(input.description, "Description"),
        imageFileId: input.imageFileId,
        analysis: input.analysis,
        sharedWithCareTeam: input.sharedWithCareTeam,
        createdAt: now,
        updatedAt: now,
      };
      db.healthConcerns.push(concern);
      this.timeline(db, {
        patientId: input.patientId,
        kind: "concern",
        title: "Health concern saved",
        summary: concern.description,
        sourceLabel: "Submitted by the patient. The AI response is separate from this description.",
        refTable: "health_concerns",
        refId: concern.id,
      });
      if (input.sharedWithCareTeam) this.shareConcern(db, concern);
      this.persist();
      return concern;
    });
  }

  private shareConcern(db: DemoDatabase, concern: HealthConcern): void {
    const patient = this.patientOf(db, concern.patientId);
    const name = this.profileById(db, patient.profileId).fullName;
    for (const link of db.patientDoctors) {
      if (link.patientId !== concern.patientId || link.status !== "active") continue;
      const doctor = db.doctors.find((item) => item.id === link.doctorId);
      if (!doctor) continue;
      this.notify(db, {
        profileId: doctor.profileId,
        kind: "app",
        title: "Shared health concern",
        body: `${name} shared a health concern for your review.`,
        href: `/doctor/patients/${concern.patientId}`,
      });
    }
  }

  async setConcernSharing(actor: Actor, id: string, shared: boolean): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const concern = db.healthConcerns.find((item) => item.id === id);
      if (!concern) throw new AccessError("That health concern was not found.");
      assertCan(canWriteOwnRecord(actor, concern.patientId));
      const wasShared = concern.sharedWithCareTeam;
      concern.sharedWithCareTeam = shared;
      concern.updatedAt = new Date().toISOString();
      if (shared && !wasShared) this.shareConcern(db, concern);
      this.persist();
    });
  }

  async getTimelineEvent(actor: Actor, id: string): Promise<TimelineEvent> {
    return this.enqueue(() => {
      const db = this.load();
      const event = db.timeline.find((item) => item.id === id);
      if (!event || !this.visibleEvent(actor, event, db)) throw new AccessError("That timeline entry was not found.");
      return event;
    });
  }

  async addPatientNote(actor: Actor, patientId: string, body: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      assertCan(canWriteOwnRecord(actor, patientId));
      const text = clean(body, "Note");
      const id = crypto.randomUUID();
      this.timeline(db, {
        patientId,
        kind: "patient_note",
        title: "Personal note",
        summary: text,
        sourceLabel: "Written by the patient",
        refTable: "patient_notes",
        refId: id,
      });
      this.persist();
    });
  }

  async addDoctorNote(actor: Actor, patientId: string, body: string): Promise<DoctorNote> {
    return this.enqueue(() => {
      const db = this.load();
      assertCan(canAddDoctorNote(actor, patientId, this.context(db)));
      if (!actor.doctorId) throw new AccessError();
      const now = new Date().toISOString();
      const note: DoctorNote = {
        id: crypto.randomUUID(),
        patientId,
        doctorId: actor.doctorId,
        body: clean(body, "Note"),
        createdAt: now,
        updatedAt: now,
      };
      db.doctorNotes.push(note);
      this.timeline(db, {
        patientId,
        kind: "doctor_note",
        title: `Note from ${actor.fullName}`,
        summary: note.body,
        sourceLabel: "Healthcare professional note",
        refTable: "doctor_notes",
        refId: note.id,
      });
      const patient = this.patientOf(db, patientId);
      this.notify(db, {
        profileId: patient.profileId,
        kind: "doctor_message",
        title: `Note from ${actor.fullName}`,
        body: "Your clinician added a note to your record.",
        href: "/patient/timeline",
      });
      this.persist();
      return note;
    });
  }

  async addDocument(actor: Actor, input: DocumentInput): Promise<HealthDocument> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId) throw new AccessError();
      assertCan(canWriteOwnRecord(actor, actor.patientId));
      if (input.fileId) {
        const file = db.files.find((item) => item.id === input.fileId);
        if (!file || file.patientId !== actor.patientId) throw new AccessError("That file is not in this record.");
      }
      if (!input.fileId && !input.sourceText.trim()) throw new ValidationError("Add a file or paste the document text.");
      const now = new Date().toISOString();
      const document: HealthDocument = {
        id: crypto.randomUUID(),
        patientId: actor.patientId,
        title: clean(input.title, "Title", 160),
        kind: input.kind,
        fileId: input.fileId,
        sourceText: input.sourceText.trim().slice(0, 12000),
        aiExplanation: input.aiExplanation,
        createdAt: now,
        updatedAt: now,
      };
      db.documents.push(document);
      this.timeline(db, {
        patientId: actor.patientId,
        kind: "document",
        title: `Document added: ${document.title}`,
        summary: document.sourceText ? document.sourceText.slice(0, 400) : "A file was uploaded.",
        sourceLabel: "Uploaded by the patient",
        refTable: "health_documents",
        refId: document.id,
      });
      this.persist();
      return document;
    });
  }

  async addClinicianDocument(actor: Actor, input: ClinicianDocumentInput): Promise<HealthDocument> {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "doctor") throw new AccessError("Only a clinician can add a record this way.");
      this.view(actor, input.patientId, "documents", db);
      const kinds = ["prescription", "record", "lab", "other"];
      if (!kinds.includes(input.kind)) throw new ValidationError("Choose a document kind.");
      let fileId: string | null = null;
      if (input.file) {
        const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"];
        if (input.file.data.length === 0) throw new ValidationError("Choose a file to upload.");
        if (input.file.data.length > 8 * 1024 * 1024) throw new ValidationError("Files need to be 8 MB or smaller.");
        if (!allowed.includes(input.file.mimeType)) throw new ValidationError("Upload a photo, PDF, or text file.");
        fileId = crypto.randomUUID();
        db.files.push({
          id: fileId,
          patientId: input.patientId,
          bucket: "documents",
          fileName: input.file.fileName.slice(0, 180) || "upload",
          mimeType: input.file.mimeType,
          bytes: input.file.data.length,
          createdAt: new Date().toISOString(),
        });
        this.writeBytes(fileId, input.file.data);
      }
      if (!fileId && !input.sourceText.trim()) throw new ValidationError("Add a file or paste the document text.");
      const now = new Date().toISOString();
      const document: HealthDocument = {
        id: crypto.randomUUID(),
        patientId: input.patientId,
        title: clean(input.title, "Title", 160),
        kind: input.kind,
        fileId,
        sourceText: input.sourceText.trim().slice(0, 12000),
        aiExplanation: input.aiExplanation,
        createdAt: now,
        updatedAt: now,
      };
      db.documents.push(document);
      this.timeline(db, {
        patientId: input.patientId,
        kind: "document",
        title: `Document added: ${document.title}`,
        summary: document.sourceText ? document.sourceText.slice(0, 400) : "A file was added.",
        sourceLabel: `Added by ${actor.fullName}`,
        refTable: "health_documents",
        refId: document.id,
      });
      const patient = this.patientOf(db, input.patientId);
      this.notify(db, {
        profileId: patient.profileId,
        kind: "doctor_message",
        title: `${actor.fullName} added a document`,
        body: "The original file or text is on your health page.",
        href: `/patient/health/documents/${document.id}`,
      });
      this.persist();
      return document;
    });
  }

  async getDocument(actor: Actor, id: string): Promise<HealthDocument> {
    return this.enqueue(() => {
      const db = this.load();
      const document = db.documents.find((item) => item.id === id);
      if (!document) throw new AccessError("That document was not found.");
      this.view(actor, document.patientId, "documents", db);
      return document;
    });
  }

  async saveDocumentExplanation(actor: Actor, id: string, explanation: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const document = db.documents.find((item) => item.id === id);
      if (!document) throw new AccessError("That document was not found.");
      assertCan(canWriteOwnRecord(actor, document.patientId));
      document.aiExplanation = clean(explanation, "Explanation", 8000);
      document.updatedAt = new Date().toISOString();
      this.persist();
    });
  }

  async saveUpload(actor: Actor, input: UploadInput): Promise<{ id: string }> {
    return this.enqueue(() => {
      const db = this.load();
      assertCan(canWriteOwnRecord(actor, input.patientId));
      if (input.data.length === 0) throw new ValidationError("Choose a file to upload.");
      if (input.data.length > 8 * 1024 * 1024) throw new ValidationError("Files need to be 8 MB or smaller.");
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "application/pdf", "text/plain"];
      if (!allowed.includes(input.mimeType)) throw new ValidationError("Upload a photo, PDF, or text file.");
      const id = crypto.randomUUID();
      db.files.push({
        id,
        patientId: input.patientId,
        bucket: input.bucket,
        fileName: input.fileName.slice(0, 180) || "upload",
        mimeType: input.mimeType,
        bytes: input.data.length,
        createdAt: new Date().toISOString(),
      });
      this.writeBytes(id, input.data);
      this.persist();
      return { id };
    });
  }

  async readUpload(actor: Actor, fileId: string) {
    return this.enqueue(() => {
      const db = this.load();
      const file = db.files.find((item) => item.id === fileId);
      if (!file) throw new AccessError("That file was not found.");
      assertCan(canReadFile(actor, file.patientId, file.bucket, this.context(db)));
      const full = path.join(this.dir, "files", file.id);
      if (!fs.existsSync(full)) throw new ValidationError("This file is no longer available.");
      return { mimeType: file.mimeType, fileName: file.fileName, data: fs.readFileSync(full) };
    });
  }

  async savePrescriptionExplanation(actor: Actor, prescriptionId: string, explanation: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const prescription = db.prescriptions.find((item) => item.id === prescriptionId);
      if (!prescription) throw new AccessError("That prescription was not found.");
      this.view(actor, prescription.patientId, "medications", db);
      assertCan(canWriteOwnRecord(actor, prescription.patientId));
      const before = prescription.sourceText;
      prescription.aiExplanation = clean(explanation, "Explanation");
      prescription.updatedAt = new Date().toISOString();
      if (prescription.sourceText !== before) throw new ValidationError("The original prescription was protected from change.");
      this.persist();
    });
  }

  async getConversation(actor: Actor) {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "patient" || !actor.patientId) throw new AccessError("The assistant uses your own health record.");
      let conversation = db.conversations.find((item) => item.patientId === actor.patientId);
      if (!conversation) {
        conversation = {
          id: crypto.randomUUID(),
          patientId: actor.patientId,
          title: "Health assistant",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.conversations.push(conversation);
        this.persist();
      }
      const messages = db.messages.filter((item) => item.conversationId === conversation!.id);
      return { id: conversation.id, messages };
    });
  }

  async clearConversation(actor: Actor): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId) throw new AccessError();
      const conversation = db.conversations.find((item) => item.patientId === actor.patientId);
      if (!conversation) return;
      db.messages = db.messages.filter((item) => item.conversationId !== conversation.id);
      this.persist();
    });
  }

  async appendMessage(actor: Actor, input: NewMessage): Promise<AiMessage> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId) throw new AccessError();
      const conversation = db.conversations.find((item) => item.patientId === actor.patientId);
      if (!conversation) throw new ValidationError("Start a conversation first.");
      const message: AiMessage = {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        role: input.role,
        content: clean(input.content, "Message", 8000),
        proposedAction: input.proposedAction,
        actionStatus: input.proposedAction ? "pending" : null,
        medicationIds: input.medicationIds ?? [],
        source: input.source,
        createdAt: new Date().toISOString(),
      };
      db.messages.push(message);
      conversation.updatedAt = message.createdAt;
      this.persist();
      return message;
    });
  }

  async resolveAction(actor: Actor, messageId: string, status: "confirmed" | "dismissed"): Promise<AiMessage> {
    return this.enqueue(() => {
      const db = this.load();
      const message = db.messages.find((item) => item.id === messageId);
      if (!message || !message.proposedAction) throw new AccessError("That request was not found.");
      const conversation = db.conversations.find((item) => item.id === message.conversationId);
      if (!conversation || conversation.patientId !== actor.patientId) throw new AccessError();
      if (message.actionStatus !== "pending") throw new ValidationError("This request was already reviewed.");
      message.actionStatus = status;
      this.persist();
      return message;
    });
  }

  async listNotifications(actor: Actor): Promise<AppNotification[]> {
    return this.enqueue(() => {
      const db = this.load();
      return db.notifications
        .filter((item) => item.profileId === actor.profileId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  async markChatRead(actor: Actor, patientId: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      let changed = false;
      for (const item of db.notifications) {
        if (item.profileId !== actor.profileId || !item.href || !isUnreadChatNotice(item)) continue;
        if (!chatNoticeMatchesPatient(item.href, patientId)) continue;
        item.read = true;
        changed = true;
      }
      if (changed) this.persist();
    });
  }

  async markRead(actor: Actor, id: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const item = db.notifications.find((note) => note.id === id && note.profileId === actor.profileId);
      if (!item) throw new AccessError("That notification was not found.");
      item.read = true;
      this.persist();
    });
  }

  async markAllRead(actor: Actor): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      for (const item of db.notifications) {
        if (item.profileId === actor.profileId) item.read = true;
      }
      this.persist();
    });
  }

  async authorizeDoctor(actor: Actor, email: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "patient" || !actor.patientId) throw new AccessError();
      const doctorProfile = db.profiles.find((item) => item.email === emailOf(email) && item.role === "doctor");
      if (!doctorProfile) throw new ValidationError("No clinician account uses that email. Nothing was shared.");
      const doctor = db.doctors.find((item) => item.profileId === doctorProfile.id);
      if (!doctor) throw new ValidationError("That clinician record is incomplete.");
      const existing = db.patientDoctors.find((item) => item.patientId === actor.patientId && item.doctorId === doctor.id);
      const now = new Date().toISOString();
      if (existing) {
        existing.status = "active";
        existing.revokedAt = null;
        existing.authorizedAt = now;
      } else {
        db.patientDoctors.push({
          id: crypto.randomUUID(),
          patientId: actor.patientId,
          doctorId: doctor.id,
          status: "active",
          authorizedAt: now,
          revokedAt: null,
        });
      }
      this.notify(db, {
        profileId: doctorProfile.id,
        kind: "app",
        title: "A patient authorized you",
        body: `${actor.fullName} authorized you to review their Senior Guardian record.`,
        href: `/doctor/patients/${actor.patientId}`,
      });
      this.persist();
    });
  }

  async revokeDoctor(actor: Actor, linkId: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const link = db.patientDoctors.find((item) => item.id === linkId);
      if (!link || !canWriteOwnRecord(actor, link.patientId)) throw new AccessError();
      link.status = "revoked";
      link.revokedAt = new Date().toISOString();
      this.persist();
    });
  }

  async inviteCaregiver(actor: Actor, email: string): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId) throw new AccessError();
      const profile = db.profiles.find((item) => item.email === emailOf(email) && item.role === "caregiver");
      if (!profile) throw new ValidationError("No caregiver account uses that email. Nothing was shared.");
      const caregiver = db.caregivers.find((item) => item.profileId === profile.id);
      if (!caregiver) throw new ValidationError("That caregiver record is incomplete.");
      const existing = db.caregiverPermissions.find((item) => item.patientId === actor.patientId && item.caregiverId === caregiver.id);
      const now = new Date().toISOString();
      if (existing) {
        existing.status = "active";
        existing.revokedAt = null;
        existing.updatedAt = now;
      } else {
        db.caregiverPermissions.push({
          id: crypto.randomUUID(),
          patientId: actor.patientId,
          caregiverId: caregiver.id,
          viewMedications: false,
          viewAppointments: false,
          viewTimeline: false,
          viewConcerns: false,
          viewReadings: false,
          manageReminders: false,
          status: "active",
          createdAt: now,
          updatedAt: now,
          revokedAt: null,
        });
      }
      this.notify(db, {
        profileId: profile.id,
        kind: "caregiver",
        title: "A patient connected you",
        body: `${actor.fullName} connected you. No health information is shared until they turn a permission on.`,
        href: "/caregiver/dashboard",
      });
      this.persist();
    });
  }

  async updateCaregiverAccess(actor: Actor, permissionId: string, flags: PermissionFlags, revoke = false): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      const grant = db.caregiverPermissions.find((item) => item.id === permissionId);
      if (!grant || !canWriteOwnRecord(actor, grant.patientId)) throw new AccessError();
      grant.viewMedications = flags.viewMedications;
      grant.viewAppointments = flags.viewAppointments;
      grant.viewTimeline = flags.viewTimeline;
      grant.viewConcerns = flags.viewConcerns;
      grant.viewReadings = flags.viewReadings;
      grant.manageReminders = flags.manageReminders;
      grant.status = revoke ? "revoked" : "active";
      grant.revokedAt = revoke ? new Date().toISOString() : null;
      grant.updatedAt = new Date().toISOString();
      const caregiver = db.caregivers.find((item) => item.id === grant.caregiverId);
      if (caregiver) {
        this.notify(db, {
          profileId: caregiver.profileId,
          kind: "caregiver",
          title: "Sharing updated",
          body: revoke
            ? `${actor.fullName} revoked your access.`
            : `${actor.fullName} updated what you can see.`,
          href: "/caregiver/dashboard",
        });
      }
      this.persist();
    });
  }

  private watchList(actor: Actor, db: DemoDatabase) {
    if (actor.role === "patient" && actor.patientId) {
      const patient = this.patientOf(db, actor.patientId);
      return [
        {
          patientId: patient.id,
          patientName: this.profileById(db, patient.profileId).fullName,
          medications: true,
          appointments: true,
        },
      ];
    }
    if (actor.role !== "caregiver" || !actor.caregiverId) return [];
    return db.caregiverPermissions
      .filter((grant) => grant.status === "active" && grant.caregiverId === actor.caregiverId && (grant.manageReminders || grant.viewAppointments))
      .map((grant) => {
        const patient = this.patientOf(db, grant.patientId);
        return {
          patientId: patient.id,
          patientName: this.profileById(db, patient.profileId).fullName,
          medications: grant.manageReminders,
          appointments: grant.viewAppointments,
        };
      });
  }

  private alarmState(actor: Actor, db: DemoDatabase, now: Date): { due: DueAlarm[]; nextAt: string | null } {
    const fired = new Set(db.notifications.flatMap((item) => (item.profileId === actor.profileId && item.alarmKey ? [item.alarmKey] : [])));
    const due: DueAlarm[] = [];
    let nextAt: string | null = null;
    for (const person of this.watchList(actor, db)) {
      const doses = person.medications ? this.dosesOn(db, person.patientId, localDate(now)) : [];
      const appointments = person.appointments ? db.appointments.filter((item) => item.patientId === person.patientId) : [];
      due.push(...selectDueAlarms({ ...person, doses, appointments, fired, now }));
      const upcoming = nextAlarmAt({ doses, appointments, fired, now });
      if (upcoming && (!nextAt || upcoming < nextAt)) nextAt = upcoming;
    }
    return { due, nextAt };
  }

  async previewAlarms(actor: Actor, now = new Date()): Promise<{ due: DueAlarm[]; nextAt: string | null }> {
    return this.enqueue(() => this.alarmState(actor, this.load(), now));
  }

  async deliverAlarms(actor: Actor, drafts: AlarmDraft[], now = new Date()): Promise<DeliveredAlarm[]> {
    return this.enqueue(() => {
      const db = this.load();
      const open = new Set(this.alarmState(actor, db, now).due.map((item) => item.key));
      const created: DeliveredAlarm[] = [];
      let changed = false;
      for (const draft of drafts) {
        if (!open.has(draft.key)) continue;
        const patient = this.patientOf(db, draft.patientId);
        const recipients = [patient.profileId];
        const flag = draft.kind === "medication" ? "manageReminders" : "viewAppointments";
        for (const grant of db.caregiverPermissions) {
          if (grant.patientId !== draft.patientId || grant.status !== "active" || !grant[flag]) continue;
          const caregiver = db.caregivers.find((item) => item.id === grant.caregiverId);
          if (caregiver) recipients.push(caregiver.profileId);
        }
        if (!recipients.includes(actor.profileId)) continue;
        const patientName = this.profileById(db, patient.profileId).fullName;
        let patientIsNew = false;
        for (const profileId of recipients) {
          if (db.notifications.some((item) => item.profileId === profileId && item.alarmKey === draft.key)) continue;
          const forPatient = profileId === patient.profileId;
          const title = forPatient ? draft.title : draft.caregiverTitle;
          const body = forPatient ? draft.body : `${patientName}: ${draft.body}`;
          const href = forPatient ? draft.patientHref : `/caregiver/patients/${draft.patientId}`;
          this.notify(db, {
            profileId,
            kind: draft.kind === "medication" ? "medication" : "appointment",
            title,
            body,
            href,
            alarmKey: draft.key,
          });
          changed = true;
          if (forPatient) patientIsNew = true;
          if (profileId === actor.profileId) created.push({ key: draft.key, title, body, href });
        }
        if (patientIsNew) {
          let conversation = db.conversations.find((item) => item.patientId === draft.patientId);
          if (!conversation) {
            conversation = {
              id: crypto.randomUUID(),
              patientId: draft.patientId,
              title: "Health assistant",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            db.conversations.push(conversation);
          }
          const message: AiMessage = {
            id: crypto.randomUUID(),
            conversationId: conversation.id,
            role: "assistant",
            content: clean(draft.body, "Message", 8000),
            proposedAction: null,
            actionStatus: null,
            medicationIds: draft.medicationId ? [draft.medicationId] : [],
            source: draft.source,
            createdAt: new Date().toISOString(),
          };
          db.messages.push(message);
          conversation.updatedAt = message.createdAt;
          changed = true;
        }
      }
      if (changed) this.persist();
      return created;
    });
  }

  private readingAudience(db: DemoDatabase, patientId: string): Array<{ profileId: string; href: string }> {
    const patient = this.patientOf(db, patientId);
    const people = [{ profileId: patient.profileId, href: "/patient/devices" }];
    for (const grant of db.caregiverPermissions) {
      if (grant.patientId !== patientId || grant.status !== "active" || !grant.viewReadings) continue;
      const caregiver = db.caregivers.find((item) => item.id === grant.caregiverId);
      if (caregiver) people.push({ profileId: caregiver.profileId, href: `/caregiver/patients/${patientId}` });
    }
    for (const link of db.patientDoctors) {
      if (link.patientId !== patientId || link.status !== "active") continue;
      const doctor = db.doctors.find((item) => item.id === link.doctorId);
      if (doctor) people.push({ profileId: doctor.profileId, href: `/doctor/patients/${patientId}` });
    }
    return people;
  }

  private publicConnection(db: DemoDatabase, connection: DemoDatabase["deviceConnections"][number]): DeviceConnection {
    return { ...connection, linked: db.deviceSecrets.some((item) => item.connectionId === connection.id) };
  }

  async getDeviceBoard(actor: Actor, patientId: string): Promise<DeviceBoard> {
    return this.enqueue(() => {
      const db = this.load();
      this.view(actor, patientId, "readings", db);
      return {
        connections: db.deviceConnections.filter((item) => item.patientId === patientId).map((item) => this.publicConnection(db, item)),
        ranges: db.readingRanges.filter((item) => item.patientId === patientId),
        readings: db.deviceReadings
          .filter((item) => item.patientId === patientId)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
          .slice(0, 120),
      };
    });
  }

  async connectDevice(actor: Actor, input: { provider: DeviceConnection["provider"]; label: string }): Promise<DeviceConnection> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
      if (!isProvider(input.provider)) throw new ValidationError("Choose a device.");
      const connection = {
        id: crypto.randomUUID(),
        patientId: actor.patientId,
        provider: input.provider,
        label: clean(input.label, "Device name", 80),
        createdAt: new Date().toISOString(),
      };
      db.deviceConnections.push(connection);
      this.persist();
      return this.publicConnection(db, connection);
    });
  }

  async saveReadingRange(actor: Actor, input: { metric: DeviceReading["metric"]; low: number; high: number }): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
      if (!isMetric(input.metric)) throw new ValidationError("Choose a reading.");
      const low = parseMetricNumber(input.metric, input.low);
      const high = parseMetricNumber(input.metric, input.high);
      if (low >= high) throw new ValidationError("The low end of the range has to be below the high end.");
      const existing = db.readingRanges.find((item) => item.patientId === actor.patientId && item.metric === input.metric);
      if (existing) {
        existing.low = low;
        existing.high = high;
      } else {
        db.readingRanges.push({ id: crypto.randomUUID(), patientId: actor.patientId, metric: input.metric, low, high });
      }
      this.persist();
    });
  }

  async recordDeviceReading(
    actor: Actor,
    input: { connectionId: string; metric: DeviceReading["metric"]; value: number; recordedAt: string },
  ): Promise<DeviceReading> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
      const connection = db.deviceConnections.find((item) => item.id === input.connectionId && item.patientId === actor.patientId);
      if (!connection) throw new ValidationError("Choose a connected device.");
      if (!isMetric(input.metric)) throw new ValidationError("Choose a reading.");
      const value = parseMetricNumber(input.metric, input.value);
      const recordedAt = new Date(input.recordedAt);
      if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > Date.now() + 5 * 60_000) {
        throw new ValidationError("Use a time that has already happened.");
      }
      const range = db.readingRanges.find((item) => item.patientId === actor.patientId && item.metric === input.metric) ?? null;
      const judged = judgeReading(input.metric, value, range, connection.label);
      const reading: DeviceReading = {
        id: crypto.randomUUID(),
        patientId: actor.patientId,
        connectionId: connection.id,
        metric: input.metric,
        value,
        unit: METRICS[input.metric].unit,
        recordedAt: recordedAt.toISOString(),
        status: judged.status,
      };
      db.deviceReadings.push(reading);
      if (judged.status === "outside") {
        for (const person of this.readingAudience(db, actor.patientId)) {
          this.notify(db, {
            profileId: person.profileId,
            kind: "app",
            title: judged.title,
            body: judged.body,
            href: person.href,
            alarmKey: `reading:${reading.id}`,
          });
        }
      }
      this.persist();
      return reading;
    });
  }

  async linkDeviceAccount(actor: Actor, connectionId: string, secret: DeviceSecret): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
      const connection = db.deviceConnections.find((item) => item.id === connectionId && item.patientId === actor.patientId);
      if (!connection) throw new AccessError();
      db.deviceSecrets = db.deviceSecrets.filter((item) => item.connectionId !== connectionId);
      db.deviceSecrets.push({ connectionId, ...secret });
      this.persist();
    });
  }

  async readDeviceSecret(actor: Actor, connectionId: string): Promise<DeviceSecret | null> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.patientId || !canWriteOwnRecord(actor, actor.patientId)) throw new AccessError();
      const connection = db.deviceConnections.find((item) => item.id === connectionId && item.patientId === actor.patientId);
      if (!connection) throw new AccessError();
      const secret = db.deviceSecrets.find((item) => item.connectionId === connectionId);
      return secret ? { accessToken: secret.accessToken, refreshToken: secret.refreshToken, expiresAt: secret.expiresAt } : null;
    });
  }

  async listCareMessages(actor: Actor, patientId: string): Promise<CareMessage[]> {
    return this.enqueue(() => {
      const db = this.load();
      this.know(actor, patientId, db);
      return db.careMessages.filter((item) => item.patientId === patientId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }

  async postCareMessage(actor: Actor, patientId: string, body: string): Promise<CareMessage> {
    return this.enqueue(() => {
      const db = this.load();
      this.know(actor, patientId, db);
      const message: CareMessage = {
        id: crypto.randomUUID(),
        patientId,
        authorId: actor.profileId,
        authorName: actor.fullName,
        authorRole: actor.role,
        body: clean(body, "Message", 2000),
        createdAt: new Date().toISOString(),
      };
      db.careMessages.push(message);
      const patient = this.patientOf(db, patientId);
      const recipients = new Set<string>();
      if (patient.profileId !== actor.profileId) recipients.add(patient.profileId);
      for (const link of db.patientDoctors) {
        if (link.patientId !== patientId || link.status !== "active") continue;
        const doctor = db.doctors.find((item) => item.id === link.doctorId);
        if (doctor && doctor.profileId !== actor.profileId) recipients.add(doctor.profileId);
      }
      for (const grant of db.caregiverPermissions) {
        if (grant.patientId !== patientId || grant.status !== "active") continue;
        const caregiver = db.caregivers.find((item) => item.id === grant.caregiverId);
        if (caregiver && caregiver.profileId !== actor.profileId) recipients.add(caregiver.profileId);
      }
      const href = actor.role === "doctor" ? `/doctor/chat?patient=${patientId}` : actor.role === "caregiver" ? `/caregiver/chat?patient=${patientId}` : "/patient/chat";
      for (const profileId of recipients) {
        const recipient = db.profiles.find((item) => item.id === profileId);
        const recipientHref = recipient?.role === "doctor" ? `/doctor/chat?patient=${patientId}` : recipient?.role === "caregiver" ? `/caregiver/chat?patient=${patientId}` : "/patient/chat";
        this.notify(db, {
          profileId,
          kind: "doctor_message",
          title: `${actor.fullName} sent a message`,
          body: message.body.slice(0, 180),
          href: recipientHref || href,
        });
      }
      this.persist();
      return message;
    });
  }

  async getClinicianThread(actor: Actor) {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "doctor" || !actor.doctorId) throw new AccessError("The clinician assistant is for an authorized clinician.");
      let thread = db.clinicianThreads.find((item) => item.doctorId === actor.doctorId);
      if (!thread) {
        const now = new Date().toISOString();
        thread = { id: crypto.randomUUID(), doctorId: actor.doctorId, createdAt: now, updatedAt: now };
        db.clinicianThreads.push(thread);
        this.persist();
      }
      const threadId = thread.id;
      return {
        id: threadId,
        messages: db.clinicianMessages
          .filter((item) => item.conversationId === threadId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      };
    });
  }

  async appendClinicianMessage(actor: Actor, input: NewMessage): Promise<AiMessage> {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "doctor" || !actor.doctorId) throw new AccessError();
      const thread = db.clinicianThreads.find((item) => item.doctorId === actor.doctorId);
      if (!thread) throw new ValidationError("Open the assistant first.");
      const message: AiMessage = {
        id: crypto.randomUUID(),
        conversationId: thread.id,
        role: input.role,
        content: clean(input.content, "Message", 8000),
        proposedAction: input.proposedAction,
        actionStatus: input.proposedAction ? "pending" : null,
        medicationIds: input.medicationIds ?? [],
        source: input.source,
        createdAt: new Date().toISOString(),
      };
      db.clinicianMessages.push(message);
      thread.updatedAt = message.createdAt;
      this.persist();
      return message;
    });
  }

  async clearClinicianThread(actor: Actor): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.doctorId) throw new AccessError();
      const thread = db.clinicianThreads.find((item) => item.doctorId === actor.doctorId);
      if (!thread) return;
      db.clinicianMessages = db.clinicianMessages.filter((item) => item.conversationId !== thread.id);
      this.persist();
    });
  }

  async getCaregiverThread(actor: Actor) {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "caregiver" || !actor.caregiverId) throw new AccessError("The caregiver assistant is for someone helping a shared record.");
      let thread = db.caregiverThreads.find((item) => item.caregiverId === actor.caregiverId);
      if (!thread) {
        const now = new Date().toISOString();
        thread = { id: crypto.randomUUID(), caregiverId: actor.caregiverId, createdAt: now, updatedAt: now };
        db.caregiverThreads.push(thread);
        this.persist();
      }
      const threadId = thread.id;
      return {
        id: threadId,
        messages: db.caregiverMessages
          .filter((item) => item.conversationId === threadId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      };
    });
  }

  async appendCaregiverMessage(actor: Actor, input: NewMessage): Promise<AiMessage> {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "caregiver" || !actor.caregiverId) throw new AccessError();
      const thread = db.caregiverThreads.find((item) => item.caregiverId === actor.caregiverId);
      if (!thread) throw new ValidationError("Open the assistant first.");
      const message: AiMessage = {
        id: crypto.randomUUID(),
        conversationId: thread.id,
        role: input.role,
        content: clean(input.content, "Message", 8000),
        proposedAction: null,
        actionStatus: null,
        medicationIds: [],
        source: input.source,
        createdAt: new Date().toISOString(),
      };
      db.caregiverMessages.push(message);
      thread.updatedAt = message.createdAt;
      this.persist();
      return message;
    });
  }

  async clearCaregiverThread(actor: Actor): Promise<void> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.caregiverId) throw new AccessError();
      const thread = db.caregiverThreads.find((item) => item.caregiverId === actor.caregiverId);
      if (!thread) return;
      db.caregiverMessages = db.caregiverMessages.filter((item) => item.conversationId !== thread.id);
      this.persist();
    });
  }

  async resolveClinicianAction(actor: Actor, messageId: string, status: "confirmed" | "dismissed"): Promise<AiMessage> {
    return this.enqueue(() => {
      const db = this.load();
      if (!actor.doctorId) throw new AccessError();
      const thread = db.clinicianThreads.find((item) => item.doctorId === actor.doctorId);
      const message = db.clinicianMessages.find((item) => item.id === messageId);
      if (!thread || !message || message.conversationId !== thread.id || !message.proposedAction) throw new AccessError("That request was not found.");
      if (message.actionStatus !== "pending") throw new ValidationError("This request was already reviewed.");
      message.actionStatus = status;
      this.persist();
      return message;
    });
  }

  async scheduleVisit(actor: Actor, patientId: string, input: AppointmentInput): Promise<Appointment> {
    return this.enqueue(() => {
      const db = this.load();
      if (actor.role !== "doctor") throw new AccessError("Only a clinician can schedule a visit this way.");
      this.know(actor, patientId, db);
      const starts = new Date(input.startsAt);
      if (Number.isNaN(starts.getTime())) throw new ValidationError("Enter a valid date and time.");
      const now = new Date().toISOString();
      const appointment: Appointment = {
        id: crypto.randomUUID(),
        patientId,
        provider: clean(input.provider, "Provider", 160),
        specialty: input.specialty.trim(),
        startsAt: starts.toISOString(),
        location: input.location.trim(),
        notes: input.notes.trim(),
        questions: input.questions.map((question) => question.trim()).filter(Boolean).slice(0, 20),
        reminderEnabled: input.reminderEnabled,
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      };
      db.appointments.push(appointment);
      this.timeline(db, {
        patientId,
        kind: "appointment",
        title: `Appointment with ${appointment.provider}`,
        summary: [appointment.specialty, appointment.location].filter(Boolean).join(" at "),
        sourceLabel: `Scheduled by ${actor.fullName}`,
        refTable: "appointments",
        refId: appointment.id,
      });
      const patient = this.patientOf(db, patientId);
      this.notify(db, {
        profileId: patient.profileId,
        kind: "appointment",
        title: `Visit with ${appointment.provider}`,
        body: `${actor.fullName} added this visit. It is on your appointments page.`,
        href: `/patient/appointments/${appointment.id}`,
      });
      this.persist();
      return appointment;
    });
  }

  async resetDemo(): Promise<void> {
    return this.enqueue(() => {
      fs.rmSync(this.dir, { recursive: true, force: true });
      this.db = null;
      this.load();
    });
  }
}

let singleton: FileHealthStore | null = null;

export function getFileStore(): FileHealthStore {
  if (!singleton) singleton = new FileHealthStore(path.join(process.cwd(), ".data"));
  return singleton;
}
