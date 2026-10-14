import type { AlarmDraft, DueAlarm } from "@/lib/alarms/due";
import { formatTime, formatWhen } from "@/lib/time";

function rulesCopy(alarm: DueAlarm): string {
  if (alarm.kind === "medication") {
    return `It's time for ${alarm.name} (${formatTime(alarm.time)}). Your label says: “${alarm.instructions.trim()}”. Mark it taken after you take it. This reminder does not change the dose.`;
  }
  const when = formatWhen(alarm.startsAt);
  const place = alarm.location ? ` at ${alarm.location}` : "";
  if (alarm.phase === "day-before") {
    const questions = alarm.questions.length ? " The questions you saved are on the appointment page." : "";
    return `Your visit with ${alarm.provider} is tomorrow, ${when}${place}.${questions} This is a reminder only.`;
  }
  return `Your visit with ${alarm.provider} is coming up, ${when}${place}. This is a reminder only.`;
}

export async function alarmCopy(alarm: DueAlarm): Promise<AlarmDraft> {
  const medication = alarm.kind === "medication";
  return {
    key: alarm.key,
    kind: alarm.kind,
    patientId: alarm.patientId,
    title: medication ? `Time for ${alarm.name}` : `Visit with ${alarm.provider}`,
    caregiverTitle: medication ? `Time for ${alarm.patientName} to take ${alarm.name}` : `${alarm.patientName}'s visit with ${alarm.provider}`,
    body: rulesCopy(alarm),
    patientHref: medication ? `/patient/medications/${alarm.medicationId}` : `/patient/appointments/${alarm.appointmentId}`,
    source: "rules",
    medicationId: medication ? alarm.medicationId : null,
  };
}
