export type Role = "patient" | "doctor" | "caregiver";
export type TextScale = "default" | "large" | "largest";
export type Locale = "en" | "es";

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
  specialty: string;
  clinic: string;
  relationship: string;
};

export type Access = {
  medications: boolean;
  appointments: boolean;
  timeline: boolean;
  concerns: boolean;
  readings: boolean;
  reminders: boolean;
  notes: boolean;
};

export const PATIENT_ACCESS: Access = {
  medications: true,
  appointments: true,
  timeline: true,
  concerns: true,
  readings: true,
  reminders: true,
  notes: false,
};

export const DOCTOR_ACCESS: Access = {
  medications: true,
  appointments: true,
  timeline: true,
  concerns: true,
  readings: true,
  reminders: false,
  notes: true,
};

export type Medicine = {
  id: string;
  patientId: string;
  name: string;
  instructions: string;
  frequency: string;
  times: string[];
  status: string;
  reminderEnabled: boolean;
  prescribingProvider: string;
  notes: string;
};

export type Dose = {
  medicine: Medicine;
  time: string;
  scheduledFor: string;
  taken: boolean;
};

export type Visit = {
  id: string;
  patientId: string;
  provider: string;
  specialty: string;
  startsAt: string;
  location: string;
  notes: string;
  questions: string[];
  reminderEnabled: boolean;
  status: string;
};

export type Concern = {
  id: string;
  description: string;
  shared: boolean;
  createdAt: string;
  summary: string;
};

export type TimelineItem = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  source: string;
  createdAt: string;
};

export type Reading = {
  metric: string;
  label: string;
  value: string;
  unit: string;
  recordedAt: string;
  status: string;
  low?: string;
  high?: string;
};

export type Connection = {
  id: string;
  provider: string;
  label: string;
  status: string;
  lastReadingAt: string | null;
};

export type Notice = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  body: string;
  createdAt: string;
};

export type HealthProfile = {
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  bloodType: string;
  allergies: string;
  conditions: string;
};

export type DocumentRow = {
  id: string;
  title: string;
  kind: string;
  sourceText: string;
  createdAt: string;
};

export type PersonCard = {
  patientId: string;
  name: string;
  detail: string;
  access: Access;
};

export type PersonBundle = {
  name: string;
  age: number | null;
  health: HealthProfile | null;
  doses: Dose[];
  medicines: Medicine[];
  visits: Visit[];
  concerns: Concern[];
  timeline: TimelineItem[];
  readings: Reading[];
  documents: DocumentRow[];
};

export function homeFor(role: Role): "/patient" | "/doctor" | "/caregiver" {
  if (role === "doctor") return "/doctor";
  if (role === "caregiver") return "/caregiver";
  return "/patient";
}

export function assistantHref(role: Role, listen = false): string | null {
  const query = listen ? "?listen=1" : "";
  if (role === "patient") return `/patient/assistant${query}`;
  if (role === "doctor") return `/doctor/assistant${query}`;
  return null;
}
