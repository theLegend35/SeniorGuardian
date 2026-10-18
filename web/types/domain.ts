export type Role = "patient" | "doctor" | "caregiver";

export type TextScale = "default" | "large" | "largest";

export type Locale = "en" | "es";

export type Profile = {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  phone: string;
  textScale: TextScale;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
};

export type Patient = {
  id: string;
  profileId: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  bloodType: string;
  allergies: string;
  conditions: string;
  fictional: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Doctor = {
  id: string;
  profileId: string;
  specialty: string;
  clinic: string;
  fictional: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Caregiver = {
  id: string;
  profileId: string;
  relationship: string;
  fictional: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LinkStatus = "active" | "revoked";

export type PatientDoctor = {
  id: string;
  patientId: string;
  doctorId: string;
  status: LinkStatus;
  authorizedAt: string;
  revokedAt: string | null;
};

export type CaregiverPermission = {
  id: string;
  patientId: string;
  caregiverId: string;
  viewMedications: boolean;
  viewAppointments: boolean;
  viewTimeline: boolean;
  viewConcerns: boolean;
  viewReadings: boolean;
  manageReminders: boolean;
  status: LinkStatus;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type MedicationStatus = "active" | "archived";

export type Medication = {
  id: string;
  patientId: string;
  name: string;
  instructions: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate: string | null;
  prescribingProvider: string;
  notes: string;
  prescriptionId: string | null;
  status: MedicationStatus;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MedicationEventKind =
  | "taken"
  | "missed"
  | "reminder_set"
  | "added"
  | "updated"
  | "archived";

export type MedicationEvent = {
  id: string;
  medicationId: string;
  patientId: string;
  kind: MedicationEventKind;
  scheduledFor: string | null;
  note: string;
  createdAt: string;
};

export type Prescription = {
  id: string;
  patientId: string;
  medicationId: string | null;
  title: string;
  sourceText: string;
  fileId: string | null;
  aiExplanation: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AppointmentStatus = "scheduled" | "completed" | "archived";

export type Appointment = {
  id: string;
  patientId: string;
  provider: string;
  specialty: string;
  startsAt: string;
  location: string;
  notes: string;
  questions: string[];
  reminderEnabled: boolean;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type ConcernUrgency = "emergency" | "prompt" | "routine" | "unclear";

export type ConcernAnalysis = {
  summary: string;
  observations: string[];
  possibilities: string[];
  warningSigns: string[];
  usefulInformation: string[];
  whenToSeekCare: string;
  urgency: ConcernUrgency;
  uncertainty: string;
  insufficient: boolean;
  imageReviewed: boolean;
  source: "ai" | "rules";
  model: string | null;
};

export type HealthConcern = {
  id: string;
  patientId: string;
  description: string;
  imageFileId: string | null;
  analysis: ConcernAnalysis | null;
  sharedWithCareTeam: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimelineKind =
  | "concern"
  | "image"
  | "medication_change"
  | "medication_activity"
  | "appointment"
  | "doctor_note"
  | "patient_note"
  | "document"
  | "ai_summary";

export type TimelineEvent = {
  id: string;
  patientId: string;
  kind: TimelineKind;
  title: string;
  summary: string;
  sourceLabel: string;
  refTable: string;
  refId: string;
  createdAt: string;
};

export type DocumentKind = "prescription" | "record" | "lab" | "other";

export type HealthDocument = {
  id: string;
  patientId: string;
  title: string;
  kind: DocumentKind;
  fileId: string | null;
  sourceText: string;
  aiExplanation?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FileBucket = "concerns" | "prescriptions" | "documents";

export type StoredFile = {
  id: string;
  patientId: string;
  bucket: FileBucket;
  fileName: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
};

export type DoctorNote = {
  id: string;
  patientId: string;
  doctorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ProposedAction =
  | {
      type: "set_reminder";
      medicationId: string;
      medicationName: string;
      time: string;
      preservedInstructions: string;
    }
  | {
      type: "add_appointment";
      provider: string;
      specialty: string;
      startsAt: string;
      location: string;
      questions: string[];
      patientId?: string;
      patientName?: string;
    }
  | {
      type: "add_note";
      body: string;
      patientId?: string;
      patientName?: string;
    };

export type CareMessage = {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
};

export type AiMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  proposedAction: ProposedAction | null;
  actionStatus: "pending" | "confirmed" | "dismissed" | null;
  medicationIds?: string[];
  source?: "ai" | "rules" | "safety";
  createdAt: string;
};

export type AiConversation = {
  id: string;
  patientId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationKind =
  | "medication"
  | "appointment"
  | "doctor_message"
  | "caregiver"
  | "app";

export type DeviceProvider = "google_health" | "oura" | "withings" | "fitbit" | "watch" | "ring";

export type DeviceMetric = "heart_rate" | "sleep_hours" | "steps" | "blood_oxygen";

export type ReadingStatus = "inside" | "outside" | "no_range";

export type DeviceConnection = {
  id: string;
  patientId: string;
  provider: DeviceProvider;
  label: string;
  /** True when that company's account has been signed in on the server. The token stays on the server. */
  linked: boolean;
  createdAt: string;
};

export type ReadingRange = {
  id: string;
  patientId: string;
  metric: DeviceMetric;
  low: number;
  high: number;
};

export type DeviceReading = {
  id: string;
  patientId: string;
  connectionId: string;
  metric: DeviceMetric;
  value: number;
  unit: string;
  recordedAt: string;
  status: ReadingStatus;
};

export type AppNotification = {
  id: string;
  profileId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
  /** Set when this alert was produced by a reminder alarm, so the same time rings only once. */
  alarmKey?: string;
};

export type Database = {
  version: 1;
  seededOn: string;
  profiles: Profile[];
  patients: Patient[];
  doctors: Doctor[];
  caregivers: Caregiver[];
  patientDoctors: PatientDoctor[];
  caregiverPermissions: CaregiverPermission[];
  medications: Medication[];
  medicationEvents: MedicationEvent[];
  prescriptions: Prescription[];
  appointments: Appointment[];
  healthConcerns: HealthConcern[];
  timeline: TimelineEvent[];
  documents: HealthDocument[];
  files: StoredFile[];
  doctorNotes: DoctorNote[];
  conversations: AiConversation[];
  messages: AiMessage[];
  notifications: AppNotification[];
};

export type Actor = {
  profileId: string;
  role: Role;
  email: string;
  fullName: string;
  phone: string;
  textScale: TextScale;
  locale: Locale;
  patientId: string | null;
  doctorId: string | null;
  caregiverId: string | null;
};

export type ClinicalArea =
  | "overview"
  | "medications"
  | "appointments"
  | "timeline"
  | "concerns"
  | "documents"
  | "notes"
  | "reminders"
  | "readings";
