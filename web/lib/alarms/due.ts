import { localDate } from "@/lib/time";

export type DoseSlot = {
  medication: { id: string; name: string; instructions: string; reminderEnabled: boolean; status: string };
  time: string;
  scheduledFor: string;
  taken: boolean;
};

export type VisitSlot = {
  id: string;
  provider: string;
  specialty: string;
  startsAt: string;
  location: string;
  questions: string[];
  reminderEnabled: boolean;
  status: string;
};

export type DueMedication = {
  kind: "medication";
  key: string;
  patientId: string;
  patientName: string;
  medicationId: string;
  name: string;
  instructions: string;
  time: string;
  scheduledFor: string;
};

export type DueVisit = {
  kind: "appointment";
  key: string;
  patientId: string;
  patientName: string;
  appointmentId: string;
  provider: string;
  specialty: string;
  startsAt: string;
  location: string;
  questions: string[];
  phase: "day-before" | "soon";
};

export type DueAlarm = DueMedication | DueVisit;

export type AlarmDraft = {
  key: string;
  kind: "medication" | "appointment";
  patientId: string;
  title: string;
  caregiverTitle: string;
  body: string;
  patientHref: string;
  source: "ai" | "rules";
  medicationId: string | null;
};

export type DeliveredAlarm = {
  key: string;
  title: string;
  body: string;
  href: string;
};

/** Wall-clock `YYYY-MM-DDTHH:MM` stays local. Values with a timezone are absolute. */
export function wallClock(value: string): Date {
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0);
}

function endOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

function atLocal(day: Date, hours: number, minutes = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, 0, 0);
}

function earlier(current: string | null, candidate: Date, now: Date): string | null {
  if (candidate.getTime() <= now.getTime()) return current;
  const iso = candidate.toISOString();
  if (!current || iso < current) return iso;
  return current;
}

export function selectDueAlarms(input: {
  patientId: string;
  patientName: string;
  doses: DoseSlot[];
  appointments: VisitSlot[];
  fired: Set<string>;
  now?: Date;
}): DueAlarm[] {
  const now = input.now ?? new Date();
  const end = endOfLocalDay(now).getTime();
  const due: DueAlarm[] = [];

  for (const dose of input.doses) {
    if (!dose.medication.reminderEnabled || dose.taken || dose.medication.status !== "active") continue;
    const when = wallClock(dose.scheduledFor);
    if (Number.isNaN(when.getTime()) || when.getTime() > now.getTime() || when.getTime() > end) continue;
    if (localDate(when) !== localDate(now)) continue;
    const key = `dose:${dose.medication.id}:${dose.scheduledFor}`;
    if (input.fired.has(key)) continue;
    due.push({
      kind: "medication",
      key,
      patientId: input.patientId,
      patientName: input.patientName,
      medicationId: dose.medication.id,
      name: dose.medication.name,
      instructions: dose.medication.instructions,
      time: dose.time,
      scheduledFor: dose.scheduledFor,
    });
  }

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const eight = atLocal(now, 8);
  for (const visit of input.appointments) {
    if (!visit.reminderEnabled || visit.status !== "scheduled") continue;
    const starts = new Date(visit.startsAt);
    if (Number.isNaN(starts.getTime())) continue;
    const shared = {
      kind: "appointment" as const,
      patientId: input.patientId,
      patientName: input.patientName,
      appointmentId: visit.id,
      provider: visit.provider,
      specialty: visit.specialty,
      startsAt: visit.startsAt,
      location: visit.location,
      questions: visit.questions,
    };
    const dayBeforeKey = `visit-eve:${visit.id}`;
    if (localDate(starts) === localDate(tomorrow) && now.getTime() >= eight.getTime() && !input.fired.has(dayBeforeKey)) {
      due.push({ ...shared, key: dayBeforeKey, phase: "day-before" });
    }
    const soonKey = `visit-soon:${visit.id}`;
    const from = starts.getTime() - 60 * 60 * 1000;
    const until = starts.getTime() + 20 * 60 * 1000;
    if (now.getTime() >= from && now.getTime() <= until && !input.fired.has(soonKey)) {
      due.push({ ...shared, key: soonKey, phase: "soon" });
    }
  }

  return due;
}

export function nextAlarmAt(input: {
  doses: DoseSlot[];
  appointments: VisitSlot[];
  fired: Set<string>;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  let next: string | null = null;
  for (const dose of input.doses) {
    if (!dose.medication.reminderEnabled || dose.taken || dose.medication.status !== "active") continue;
    const when = wallClock(dose.scheduledFor);
    if (localDate(when) !== localDate(now)) continue;
    next = earlier(next, when, now);
  }
  for (const visit of input.appointments) {
    if (!visit.reminderEnabled || visit.status !== "scheduled") continue;
    const starts = new Date(visit.startsAt);
    if (Number.isNaN(starts.getTime())) continue;
    const dayBefore = new Date(starts.getFullYear(), starts.getMonth(), starts.getDate() - 1, 8, 0, 0, 0);
    if (!input.fired.has(`visit-eve:${visit.id}`)) next = earlier(next, dayBefore, now);
    if (!input.fired.has(`visit-soon:${visit.id}`)) next = earlier(next, new Date(starts.getTime() - 60 * 60 * 1000), now);
  }
  return next;
}
