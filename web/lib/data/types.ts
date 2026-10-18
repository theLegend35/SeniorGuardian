import type { AlarmDraft, DeliveredAlarm, DueAlarm } from "@/lib/alarms/due";
import type {
  Actor,
  AiMessage,
  CareMessage,
  AppNotification,
  Appointment,
  CaregiverPermission,
  ConcernAnalysis,
  ConcernUrgency,
  DoctorNote,
  DocumentKind,
  FileBucket,
  HealthConcern,
  HealthDocument,
  Medication,
  MedicationEvent,
  Patient,
  Prescription,
  Profile,
  DeviceConnection,
  DeviceMetric,
  DeviceProvider,
  DeviceReading,
  ProposedAction,
  ReadingRange,
  Locale,
  TextScale,
  TimelineEvent,
} from "@/types/domain";

export type ProfilePatch = {
  fullName?: string;
  phone?: string;
  textScale?: TextScale;
  locale?: Locale;
};

export type HealthPatch = {
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  bloodType: string;
  allergies: string;
  conditions: string;
};

export type SignupInput = {
  role: Actor["role"];
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  specialty?: string;
  clinic?: string;
  relationship?: string;
  dateOfBirth?: string;
};

export type MedicationInput = {
  name: string;
  instructions: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate: string | null;
  prescribingProvider: string;
  notes: string;
  reminderEnabled: boolean;
  labelFileId?: string | null;
};

export type AppointmentInput = {
  provider: string;
  specialty: string;
  startsAt: string;
  location: string;
  notes: string;
  questions: string[];
  reminderEnabled: boolean;
};

export type DocumentInput = {
  title: string;
  kind: DocumentKind;
  fileId: string | null;
  sourceText: string;
  aiExplanation: string | null;
};

export type ClinicianDocumentInput = {
  patientId: string;
  title: string;
  kind: DocumentKind;
  sourceText: string;
  aiExplanation: string | null;
  file: { fileName: string; mimeType: string; data: Buffer } | null;
};

export type UploadInput = {
  patientId: string;
  bucket: FileBucket;
  fileName: string;
  mimeType: string;
  data: Buffer;
};

export type PermissionFlags = Pick<
  CaregiverPermission,
  "viewMedications" | "viewAppointments" | "viewTimeline" | "viewConcerns" | "viewReadings" | "manageReminders"
>;

export type DeviceBoard = {
  connections: DeviceConnection[];
  ranges: ReadingRange[];
  readings: DeviceReading[];
};

export type DeviceSecret = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type PatientCard = {
  patientId: string;
  fullName: string;
  fictional: boolean;
  dateOfBirth: string;
  conditions: string;
  allergies: string;
  nextAppointment: string | null;
  concernCount: number;
  activeMedicationCount: number | null;
  latestConcern: { id: string; description: string; urgency: ConcernUrgency | null; createdAt: string } | null;
  lastActivity: string | null;
  access: "full" | PermissionFlags;
};

export type CareTeam = {
  doctors: Array<{
    linkId: string;
    name: string;
    email: string;
    specialty: string;
    clinic: string;
    status: "active" | "revoked";
    authorizedAt: string;
  }>;
  caregivers: Array<{
    permissionId: string;
    name: string;
    email: string;
    relationship: string;
    status: "active" | "revoked";
    flags: PermissionFlags;
  }>;
};

export type PatientChart = {
  patient: Patient;
  profile: Profile;
  medications: Medication[] | null;
  medicationEvents: MedicationEvent[] | null;
  appointments: Appointment[] | null;
  concerns: HealthConcern[] | null;
  timeline: TimelineEvent[] | null;
  documents: HealthDocument[] | null;
  prescriptions: Prescription[] | null;
  notes: Array<DoctorNote & { authorName: string }> | null;
  careTeam: CareTeam | null;
  canManageReminders: boolean;
  access: "full" | PermissionFlags;
};

export type ScheduledVisit = Appointment & { patientId: string; patientName: string };

export type TodayDose = {
  medication: Medication;
  time: string;
  scheduledFor: string;
  taken: boolean;
};

export type NewMessage = {
  content: string;
  role: "user" | "assistant";
  proposedAction: ProposedAction | null;
  medicationIds?: string[];
  source?: AiMessage["source"];
};

export interface HealthStore {
  verifyCredentials(email: string, password: string): Promise<Profile | null>;
  createAccount(input: SignupInput): Promise<Profile>;
  getActor(profileId: string): Promise<Actor | null>;
  updateProfile(actor: Actor, patch: ProfilePatch): Promise<Profile>;
  updateHealthProfile(actor: Actor, patch: HealthPatch): Promise<Patient>;
  listPatientCards(actor: Actor): Promise<PatientCard[]>;
  getChart(actor: Actor, patientId: string): Promise<PatientChart>;
  todayDoses(actor: Actor, patientId: string): Promise<TodayDose[]>;
  getMedication(actor: Actor, id: string): Promise<{ medication: Medication; prescription: Prescription | null; events: MedicationEvent[] }>;
  saveMedication(actor: Actor, input: MedicationInput, id?: string): Promise<Medication>;
  archiveMedication(actor: Actor, id: string): Promise<void>;
  markTaken(actor: Actor, medicationId: string, time: string): Promise<void>;
  setReminder(actor: Actor, medicationId: string, time: string): Promise<void>;
  getAppointment(actor: Actor, id: string): Promise<Appointment>;
  saveAppointment(actor: Actor, input: AppointmentInput, id?: string): Promise<Appointment>;
  archiveAppointment(actor: Actor, id: string): Promise<void>;
  listSchedule(actor: Actor): Promise<ScheduledVisit[]>;
  getConcern(actor: Actor, id: string): Promise<HealthConcern>;
  createConcern(actor: Actor, input: { patientId: string; description: string; imageFileId: string | null; analysis: ConcernAnalysis; sharedWithCareTeam: boolean }): Promise<HealthConcern>;
  setConcernSharing(actor: Actor, id: string, shared: boolean): Promise<void>;
  getTimelineEvent(actor: Actor, id: string): Promise<TimelineEvent>;
  addPatientNote(actor: Actor, patientId: string, body: string): Promise<void>;
  addDoctorNote(actor: Actor, patientId: string, body: string): Promise<DoctorNote>;
  addDocument(actor: Actor, input: DocumentInput): Promise<HealthDocument>;
  addClinicianDocument(actor: Actor, input: ClinicianDocumentInput): Promise<HealthDocument>;
  getDocument(actor: Actor, id: string): Promise<HealthDocument>;
  saveDocumentExplanation(actor: Actor, id: string, explanation: string): Promise<void>;
  saveUpload(actor: Actor, input: UploadInput): Promise<{ id: string }>;
  readUpload(actor: Actor, fileId: string): Promise<{ mimeType: string; fileName: string; data: Buffer }>;
  savePrescriptionExplanation(actor: Actor, prescriptionId: string, explanation: string): Promise<void>;
  getConversation(actor: Actor): Promise<{ id: string; messages: AiMessage[] }>;
  appendMessage(actor: Actor, input: NewMessage): Promise<AiMessage>;
  clearConversation(actor: Actor): Promise<void>;
  resolveAction(actor: Actor, messageId: string, status: "confirmed" | "dismissed"): Promise<AiMessage>;
  listCareMessages(actor: Actor, patientId: string): Promise<CareMessage[]>;
  postCareMessage(actor: Actor, patientId: string, body: string): Promise<CareMessage>;
  getClinicianThread(actor: Actor): Promise<{ id: string; messages: AiMessage[] }>;
  appendClinicianMessage(actor: Actor, input: NewMessage): Promise<AiMessage>;
  clearClinicianThread(actor: Actor): Promise<void>;
  getCaregiverThread(actor: Actor): Promise<{ id: string; messages: AiMessage[] }>;
  appendCaregiverMessage(actor: Actor, input: NewMessage): Promise<AiMessage>;
  clearCaregiverThread(actor: Actor): Promise<void>;
  resolveClinicianAction(actor: Actor, messageId: string, status: "confirmed" | "dismissed"): Promise<AiMessage>;
  scheduleVisit(actor: Actor, patientId: string, input: AppointmentInput): Promise<Appointment>;
  listNotifications(actor: Actor): Promise<AppNotification[]>;
  markChatRead(actor: Actor, patientId: string): Promise<void>;
  markRead(actor: Actor, id: string): Promise<void>;
  markAllRead(actor: Actor): Promise<void>;
  authorizeDoctor(actor: Actor, email: string): Promise<void>;
  revokeDoctor(actor: Actor, linkId: string): Promise<void>;
  inviteCaregiver(actor: Actor, email: string): Promise<void>;
  updateCaregiverAccess(actor: Actor, permissionId: string, flags: PermissionFlags, revoke?: boolean): Promise<void>;
  previewAlarms(actor: Actor, now?: Date): Promise<{ due: DueAlarm[]; nextAt: string | null }>;
  deliverAlarms(actor: Actor, drafts: AlarmDraft[], now?: Date): Promise<DeliveredAlarm[]>;
  getDeviceBoard(actor: Actor, patientId: string): Promise<DeviceBoard>;
  connectDevice(actor: Actor, input: { provider: DeviceProvider; label: string }): Promise<DeviceConnection>;
  saveReadingRange(actor: Actor, input: { metric: DeviceMetric; low: number; high: number }): Promise<void>;
  recordDeviceReading(actor: Actor, input: { connectionId: string; metric: DeviceMetric; value: number; recordedAt: string }): Promise<DeviceReading>;
  linkDeviceAccount(actor: Actor, connectionId: string, secret: DeviceSecret): Promise<void>;
  readDeviceSecret(actor: Actor, connectionId: string): Promise<DeviceSecret | null>;
  resetDemo(): Promise<void>;
}
