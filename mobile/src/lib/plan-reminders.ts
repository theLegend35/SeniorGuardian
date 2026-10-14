import { formatTime, formatWhen, isTime, localDate } from "./format";

export type ReminderMedicine = {
  id: string;
  name: string;
  instructions: string;
  times: string[];
  reminderEnabled: boolean;
  status: string;
};

export type ReminderVisit = {
  id: string;
  provider: string;
  startsAt: string;
  location: string;
  reminderEnabled: boolean;
  status: string;
};

export type ReminderPerson = {
  patientId: string;
  patientName: string;
  self: boolean;
  medications: boolean;
  appointments: boolean;
  medicines: ReminderMedicine[];
  taken: string[];
  visits: ReminderVisit[];
};

export type PlannedReminder = {
  identifier: string;
  at: Date;
  title: string;
  body: string;
  href: string;
};

const MAX = 60;
const DAYS = 7;

function atLocal(now: Date, offset: number, hour: number, minute: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
}

function medicineBody(name: string, time: string, instructions: string, patientName: string, self: boolean): string {
  const clock = formatTime(time);
  const label = instructions.trim();
  if (self) {
    return `It's time for ${name} (${clock}). Your label says: “${label}”. Mark it taken after you take it. This reminder does not change the dose.`;
  }
  return `It's time for ${patientName} to take ${name} (${clock}). The label says: “${label}”. This reminder does not change the dose.`;
}

function visitBody(provider: string, startsAt: string, location: string, phase: "day-before" | "soon", patientName: string, self: boolean): string {
  const when = formatWhen(startsAt);
  const place = location ? ` at ${location}` : "";
  const who = self ? "Your visit" : `${patientName}'s visit`;
  if (phase === "day-before") return `${who} with ${provider} is tomorrow, ${when}${place}. This is a reminder only.`;
  return `${who} with ${provider} is coming up, ${when}${place}. This is a reminder only.`;
}

/** Future phone alarms for the next week. Past times are left to the dose list. */
export function planReminders(input: { now: Date; people: ReminderPerson[] }): { reminders: PlannedReminder[]; capped: boolean } {
  const now = input.now;
  const soonest = now.getTime() + 15_000;
  const horizon = now.getTime() + DAYS * 24 * 60 * 60 * 1000;
  const taken = new Set<string>();
  const reminders: PlannedReminder[] = [];

  for (const person of input.people) {
    for (const key of person.taken) taken.add(key);
    const href = person.self ? "" : `/caregiver/person/${person.patientId}`;

    if (person.medications) {
      for (const medicine of person.medicines) {
        if (!medicine.reminderEnabled || medicine.status !== "active") continue;
        for (const time of medicine.times) {
          if (!isTime(time)) continue;
          const [hour, minute] = time.split(":").map(Number);
          for (let offset = 0; offset < DAYS; offset += 1) {
            const at = atLocal(now, offset, hour, minute);
            if (at.getTime() < soonest || at.getTime() > horizon) continue;
            const scheduledFor = `${localDate(at)}T${time}`;
            if (taken.has(`${medicine.id}|${scheduledFor}`)) continue;
            reminders.push({
              identifier: `sg-dose-${medicine.id}-${localDate(at)}-${time.replace(":", "")}`,
              at,
              title: person.self ? `Time for ${medicine.name}` : `Time for ${person.patientName} to take ${medicine.name}`,
              body: medicineBody(medicine.name, time, medicine.instructions, person.patientName, person.self),
              href: person.self ? `/patient/medicine/${medicine.id}` : href,
            });
          }
        }
      }
    }

    if (person.appointments) {
      for (const visit of person.visits) {
        if (!visit.reminderEnabled || visit.status !== "scheduled") continue;
        const starts = new Date(visit.startsAt);
        if (Number.isNaN(starts.getTime())) continue;
        const dayBefore = new Date(starts.getFullYear(), starts.getMonth(), starts.getDate() - 1, 8, 0, 0, 0);
        const soon = new Date(starts.getTime() - 60 * 60 * 1000);
        const visitHref = person.self ? "/patient/visits" : href;
        if (dayBefore.getTime() >= soonest && dayBefore.getTime() <= horizon) {
          reminders.push({
            identifier: `sg-visit-eve-${visit.id}`,
            at: dayBefore,
            title: person.self ? `Visit with ${visit.provider}` : `${person.patientName}'s visit with ${visit.provider}`,
            body: visitBody(visit.provider, visit.startsAt, visit.location, "day-before", person.patientName, person.self),
            href: visitHref,
          });
        }
        if (soon.getTime() >= soonest && soon.getTime() <= horizon) {
          reminders.push({
            identifier: `sg-visit-soon-${visit.id}`,
            at: soon,
            title: person.self ? `Visit with ${visit.provider}` : `${person.patientName}'s visit with ${visit.provider}`,
            body: visitBody(visit.provider, visit.startsAt, visit.location, "soon", person.patientName, person.self),
            href: visitHref,
          });
        }
      }
    }
  }

  reminders.sort((a, b) => a.at.getTime() - b.at.getTime());
  return { reminders: reminders.slice(0, MAX), capped: reminders.length > MAX };
}
