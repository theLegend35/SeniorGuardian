import type { ProposedAction } from "@/types/domain";

export type MedicationFact = {
  id: string;
  name: string;
  instructions: string;
  frequency: string;
  times: string[];
  prescribingProvider: string;
  status: "active" | "archived";
};

export type AppointmentFact = {
  id: string;
  provider: string;
  specialty: string;
  startsAt: string;
  location: string;
  questions: string[];
  status: string;
};

export type ConcernFact = {
  id: string;
  description: string;
  createdAt: string;
};

export type PatientContext = {
  patientName: string;
  allergies: string;
  conditions: string;
  medications: MedicationFact[];
  appointments: AppointmentFact[];
  concerns: ConcernFact[];
};

export type AssistantAnswer = {
  content: string;
  proposedAction: ProposedAction | null;
  blocked: boolean;
  medicationIds: string[];
  source: "ai" | "rules" | "safety";
};

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export type LabelReading = {
  medicationName: string;
  instructions: string;
  frequency: string;
  prescriber: string;
  pharmacy: string;
  confidence: "high" | "medium" | "low";
  notes: string;
};
