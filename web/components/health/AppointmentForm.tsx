import { ActionForm } from "@/components/ui/forms";
import { Field, SwitchRow, TextArea } from "@/components/ui/primitives";
import { saveAppointmentAction } from "@/lib/actions/health";
import type { Appointment } from "@/types/domain";

function localParts(iso: string | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "09:00" };
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function AppointmentForm({ appointment }: { appointment?: Appointment }) {
  const when = localParts(appointment?.startsAt);
  return (
    <ActionForm action={saveAppointmentAction} submit={appointment ? "Save changes" : "Save appointment"} size="lg">
      {appointment ? <input type="hidden" name="id" value={appointment.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Who are you seeing?" name="provider" required defaultValue={appointment?.provider} placeholder="Dr. Marcus Hale" />
        <Field label="Type of visit" name="specialty" defaultValue={appointment?.specialty} placeholder="Check-up, eye exam, lab work…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" name="date" type="date" required defaultValue={when.date} />
        <Field label="Time" name="time" type="time" required defaultValue={when.time} />
      </div>
      <Field label="Where" name="location" defaultValue={appointment?.location} placeholder="Clinic name and address" />
      <TextArea
        label="Questions to ask"
        name="questions"
        rows={4}
        defaultValue={appointment?.questions.join("\n")}
        placeholder={"One question per line, for example:\nShould I keep taking vitamin D in the summer?"}
        hint="One per line. You can add more any time before the visit."
      />
      <TextArea label="Notes" name="notes" rows={2} defaultValue={appointment?.notes} placeholder="Bring your pill bottles, arrive 15 minutes early…" />
      <SwitchRow label="Remind me the day before" name="reminderEnabled" defaultChecked={appointment?.reminderEnabled ?? true} />
    </ActionForm>
  );
}
