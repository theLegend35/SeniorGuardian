import type {
  Actor,
  CaregiverPermission,
  ClinicalArea,
  FileBucket,
  PatientDoctor,
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
