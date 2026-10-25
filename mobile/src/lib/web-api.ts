import { supabase, webUrl } from "@/lib/supabase";

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

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposedAction: ProposedAction | null;
  actionStatus: "pending" | "confirmed" | "dismissed" | null;
  medicationIds?: string[];
  source?: "ai" | "rules" | "safety";
};

export type AssistantLabel = { name: string; text: string; prescriber: string };

export type PatientAssistant = {
  messages: AssistantMessage[];
  labels: Record<string, AssistantLabel>;
  suggestions: string[];
  ai: { configured: boolean; label: string };
  medicines: Array<{ id: string; name: string; times: string[] }>;
  notice?: string;
};

export type ClinicianAssistant = {
  messages: AssistantMessage[];
  patients: Array<{ patientId: string; fullName: string }>;
  suggestions: string[];
  ai: { configured: boolean; label: string };
  notice?: string;
};

export type CaregiverAssistant = {
  messages: AssistantMessage[];
  suggestions: string[];
  ai: { configured: boolean; label: string };
};

export type CarePlace = {
  id: string;
  name: string;
  kind: string;
  address: string;
  phone: string | null;
  location: { lat: number; lng: number };
  distanceMiles: number | null;
  openNow: boolean | null;
  hours: string[];
  rating: number | null;
  ratingCount: number | null;
  mapsUrl: string;
  website: string | null;
};

export type FinderResult = {
  places: CarePlace[];
  origin: { lat: number; lng: number } | null;
  originLabel: string | null;
  source: "google" | "osm";
  notice: string | null;
};

export type PickedFile = { uri: string; name: string; mimeType?: string | null; file?: Blob };

async function webApi<T>(path: string, init?: RequestInit): Promise<T> {
  if (!webUrl) throw new Error("Set EXPO_PUBLIC_WEB_URL so this phone can reach the assistant and Find care.");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to use this.");
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    response = await fetch(`${webUrl}${path}`, { ...init, headers });
  } catch {
    throw new Error("The website could not be reached. Check that it is running, and that EXPO_PUBLIC_WEB_URL points at it.");
  }
  const text = await response.text();
  let payload: { error?: string } | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as { error?: string };
    } catch {
      payload = null;
    }
  }
  if (!response.ok) throw new Error(payload?.error || "The website could not complete that.");
  return payload as T;
}

const COMPANY_ORIGIN = {
  google_health: "https://accounts.google.com",
  oura: "https://cloud.ouraring.com",
  withings: "https://account.withings.com",
} as const;

export async function startDeviceSignIn(provider: keyof typeof COMPANY_ORIGIN) {
  if (!webUrl) throw new Error("Set EXPO_PUBLIC_WEB_URL so this phone can reach the website.");
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token) throw new Error("Sign in on this phone first.");
  let response: Response;
  try {
    response = await fetch(`${webUrl}/api/mobile/site-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
  } catch {
    throw new Error("The website could not be reached. Check that it is running, and that EXPO_PUBLIC_WEB_URL points at it.");
  }
  const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
  let opened: URL | null = null;
  try {
    opened = payload?.url ? new URL(payload.url) : null;
  } catch {
    opened = null;
  }
  if (!response.ok || !opened || opened.origin !== COMPANY_ORIGIN[provider]) throw new Error(payload?.error || "That sign-in could not open.");
  return opened.toString();
}

export function syncDevice(provider: keyof typeof COMPANY_ORIGIN) {
  return webApi<{ count: number; outside: boolean; alerted?: boolean }>("/api/mobile/devices/sync", { method: "POST", body: JSON.stringify({ provider }) });
}

export function loadPatientAssistant() {
  return webApi<PatientAssistant>("/api/mobile/assistant");
}

export function postPatientAssistant(body: { intent: "ask"; question: string } | { intent: "clear" } | { intent: "resolve"; messageId: string; decision: "confirm" | "dismiss" }) {
  return webApi<PatientAssistant>("/api/mobile/assistant", { method: "POST", body: JSON.stringify(body) });
}

export function loadClinicianAssistant() {
  return webApi<ClinicianAssistant>("/api/mobile/clinician-assistant");
}

export function postClinicianAssistant(
  body: { intent: "ask"; question: string; patientId?: string } | { intent: "clear" } | { intent: "resolve"; messageId: string; decision: "confirm" | "dismiss" },
) {
  return webApi<ClinicianAssistant>("/api/mobile/clinician-assistant", { method: "POST", body: JSON.stringify(body) });
}

export function askClinicianWithFile(question: string, patientId: string, picked: PickedFile) {
  const form = new FormData();
  form.append("intent", "ask");
  form.append("question", question);
  form.append("patientId", patientId);
  if (picked.file) form.append("file", picked.file, picked.name);
  else form.append("file", { uri: picked.uri, name: picked.name, type: picked.mimeType || "application/octet-stream" } as unknown as Blob);
  return webApi<ClinicianAssistant>("/api/mobile/clinician-assistant", { method: "POST", body: form });
}

export function loadCaregiverAssistant() {
  return webApi<CaregiverAssistant>("/api/mobile/caregiver-assistant");
}

export function postCaregiverAssistant(body: { intent: "ask"; question: string } | { intent: "clear" }) {
  return webApi<CaregiverAssistant>("/api/mobile/caregiver-assistant", { method: "POST", body: JSON.stringify(body) });
}

export type CareFlags = {
  viewMedications: boolean;
  viewAppointments: boolean;
  viewTimeline: boolean;
  viewConcerns: boolean;
  viewReadings: boolean;
  manageReminders: boolean;
};

export type CareTeam = {
  doctors: Array<{ linkId: string; name: string; specialty: string; clinic: string }>;
  caregivers: Array<{ permissionId: string; name: string; relationship: string; flags: CareFlags }>;
  notice?: string;
};

export function loadCareTeam() {
  return webApi<CareTeam>("/api/mobile/care-team");
}

export function updateCareTeam(
  body:
    | { intent: "authorize-doctor" | "invite-caregiver"; email: string }
    | { intent: "revoke-doctor"; linkId: string }
    | { intent: "update-caregiver"; permissionId: string; flags: CareFlags }
    | { intent: "revoke-caregiver"; permissionId: string; flags: CareFlags },
) {
  return webApi<CareTeam>("/api/mobile/care-team", { method: "POST", body: JSON.stringify(body) });
}

export function revisePrescription(body: { medicationId: string; name: string; instructions: string; frequency: string; times: string[] }) {
  return webApi<{ notice: string }>("/api/mobile/prescription", { method: "POST", body: JSON.stringify(body) });
}

export type AiProvider = "ours" | "groq" | "claude" | "gemini" | "chatgpt";
export type OursChoice = "gemini" | "groq";

export type AiSettings = {
  provider: AiProvider;
  ours: OursChoice;
  model: string;
  hasKey: boolean;
  keyHint: string;
  ready: { gemini: boolean; groq: boolean };
  activeLabel: string;
  activeModel: string;
  configured: boolean;
  usingServerGroq: boolean;
};

export function loadAiSettings() {
  return webApi<AiSettings>("/api/mobile/ai-settings");
}

export function saveAiSettings(body: { provider: AiProvider; ours: OursChoice; model: string; apiKey: string; clearKey: boolean }) {
  return webApi<AiSettings>("/api/mobile/ai-settings", { method: "POST", body: JSON.stringify(body) });
}

export function findPlaces(query: { category: string; lat?: number; lng?: number; near?: string }) {
  const params = new URLSearchParams({ category: query.category });
  if (query.lat != null && query.lng != null) {
    params.set("lat", String(query.lat));
    params.set("lng", String(query.lng));
  } else if (query.near) params.set("near", query.near);
  return webApi<FinderResult>(`/api/places?${params.toString()}`);
}
