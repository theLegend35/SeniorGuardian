import type {
  Actor,
  CaregiverPermission,
  ClinicalArea,
  FileBucket,
  PatientDoctor,
  TimelineKind,
} from "@/types/domain";

export class AccessError extends Error {
  constructor(message = "You do not have access to this information.") {
    super(message);
    this.name = "AccessError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** The account exists but its email address is not confirmed yet. Shown as a notice, not an error. */
export class ConfirmEmailError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = "ConfirmEmailError";
  }
}

export type AccessContext = {
  patientDoctors: Pick<PatientDoctor, "patientId" | "doctorId" | "status">[];
  caregiverPermissions: Pick<
    CaregiverPermission,
    | "patientId"
    | "caregiverId"
    | "status"
    | "viewMedications"
    | "viewAppointments"
    | "viewTimeline"
    | "viewConcerns"
    | "viewReadings"
    | "manageReminders"
  >[];
};

export function homeFor(role: Actor["role"]): string {
  if (role === "doctor") return "/doctor/dashboard";
  if (role === "caregiver") return "/caregiver/dashboard";
  return "/patient/dashboard";
}

function activeGrant(actor: Actor, patientId: string, ctx: AccessContext) {
  if (actor.role !== "caregiver" || !actor.caregiverId) return null;
  return (
    ctx.caregiverPermissions.find(
      (grant) =>
        grant.patientId === patientId &&
        grant.caregiverId === actor.caregiverId &&
        grant.status === "active",
    ) ?? null
  );
}

function doctorLinked(actor: Actor, patientId: string, ctx: AccessContext): boolean {
  if (actor.role !== "doctor" || !actor.doctorId) return false;
  return ctx.patientDoctors.some(
    (link) =>
      link.patientId === patientId &&
      link.doctorId === actor.doctorId &&
      link.status === "active",
  );
}

export function canKnowPatient(actor: Actor, patientId: string, ctx: AccessContext): boolean {
  if (actor.role === "patient") return actor.patientId === patientId;
  if (actor.role === "doctor") return doctorLinked(actor, patientId, ctx);
  return activeGrant(actor, patientId, ctx) !== null;
}

export function canViewArea(
  actor: Actor,
  patientId: string,
  area: ClinicalArea,
  ctx: AccessContext,
): boolean {
  if (!canKnowPatient(actor, patientId, ctx)) return false;
  if (actor.role === "patient") return true;
  if (actor.role === "doctor") return area !== "reminders";
  const grant = activeGrant(actor, patientId, ctx);
  if (!grant) return false;
  switch (area) {
    case "overview":
      return (
        grant.viewMedications ||
        grant.viewAppointments ||
        grant.viewTimeline ||
        grant.viewConcerns ||
        grant.viewReadings
      );
    case "medications":
      return grant.viewMedications;
    case "appointments":
      return grant.viewAppointments;
    case "timeline":
    case "documents":
    case "notes":
      return grant.viewTimeline;
    case "concerns":
      return grant.viewConcerns;
    case "reminders":
      return grant.manageReminders;
    case "readings":
      return grant.viewReadings;
    default:
      return false;
  }
}

type PatientDetails = { dateOfBirth: string; address: string; emergencyContact: string; bloodType: string; allergies: string; conditions: string };

/**
 * The part of the patient's own details a viewer may see. Caregivers get the birth date once
 * any section is shared and allergies with Medicines. Conditions, address, blood type, and the
 * emergency contact are not a section a patient can share, so caregivers never see them.
 */
export function visiblePatient<T extends PatientDetails>(actor: Actor, patientId: string, patient: T, ctx: AccessContext): T {
  if (actor.role !== "caregiver") return patient;
  return {
    ...patient,
    dateOfBirth: canViewArea(actor, patientId, "overview", ctx) ? patient.dateOfBirth : "",
    address: "",
    emergencyContact: "",
    bloodType: "",
    conditions: "",
    allergies: canViewArea(actor, patientId, "medications", ctx) ? patient.allergies : "",
  };
}

/** The section a timeline entry belongs to. */
export const TIMELINE_AREA: Record<TimelineKind, ClinicalArea> = {
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

export function canManageReminders(actor: Actor, patientId: string, ctx: AccessContext): boolean {
  if (actor.role === "patient") return actor.patientId === patientId;
  if (actor.role !== "caregiver") return false;
  return activeGrant(actor, patientId, ctx)?.manageReminders === true;
}

export function canWriteOwnRecord(actor: Actor, patientId: string): boolean {
  return actor.role === "patient" && actor.patientId === patientId;
}

/** The patient can edit their own saved prescription. A linked clinician can replace that wording. A caregiver cannot. */
export function canRevisePrescription(actor: Actor, patientId: string, ctx: AccessContext): boolean {
  return canWriteOwnRecord(actor, patientId) || doctorLinked(actor, patientId, ctx);
}

export function canAddDoctorNote(actor: Actor, patientId: string, ctx: AccessContext): boolean {
  return doctorLinked(actor, patientId, ctx);
}

export function canReadFile(
  actor: Actor,
  patientId: string,
  bucket: FileBucket,
  ctx: AccessContext,
): boolean {
  if (bucket === "concerns") return canViewArea(actor, patientId, "concerns", ctx);
  if (bucket === "prescriptions") return canViewArea(actor, patientId, "medications", ctx);
  return canViewArea(actor, patientId, "documents", ctx);
}

export function assertCan(
  allowed: boolean,
  message = "You do not have access to this information.",
): void {
  if (!allowed) throw new AccessError(message);
}
