import { notFound } from "next/navigation";
import { CircleHelp, Clock, MapPin, Navigation, NotebookPen, Pencil, Trash2 } from "lucide-react";

import { AppointmentForm } from "@/components/health/AppointmentForm";
import { ActionForm } from "@/components/ui/forms";
import { InlineAction } from "@/components/ui/InlineAction";
import { PrintButton } from "@/components/ui/PrintButton";
import { Badge, Card, CardHeader, DateTile, EmptyState, Field, LinkButton, PageHeader } from "@/components/ui/primitives";
import { addQuestionAction, archiveAppointmentAction } from "@/lib/actions/health";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatDate, dayParts, relativeDay } from "@/lib/time";

export const metadata = { title: "Appointment" };

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actor = await requireRole("patient");
  const appointment = await (await getStore()).getAppointment(actor, id).catch((error) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });
  const parts = dayParts(appointment.startsAt);
  const past = new Date(appointment.startsAt) < new Date();

  if (query.edit) {
    return (
      <div className="mx-auto grid max-w-3xl gap-6">
        <PageHeader back={{ href: `/patient/appointments/${appointment.id}`, label: appointment.provider }} title="Edit appointment" />
        <section className="card p-6">
          <AppointmentForm appointment={appointment} />
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ href: "/patient/appointments", label: "Appointments" }}
        title={appointment.provider}
        description={appointment.specialty || "Appointment"}
        actions={
          <>
            <PrintButton label="Print questions" />
            <LinkButton href={`/patient/appointments/${appointment.id}?edit=1`} variant="secondary">
              <Pencil className="size-4" aria-hidden /> Edit
            </LinkButton>
            <InlineAction action={archiveAppointmentAction} fields={{ id: appointment.id }} variant="danger" size="md" pending="Removing…" confirm="Remove this appointment from your list?">
              <Trash2 className="size-4" aria-hidden /> Remove
            </InlineAction>
          </>
        }
      />

      <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <DateTile iso={appointment.startsAt} tone={past ? "neutral" : "brand"} />
        <div className="grid flex-1 gap-1.5">
          <p className="flex items-center gap-2 text-[1.15rem] font-bold text-ink-950">
            {formatDate(appointment.startsAt)}
            <Badge tone={past ? "neutral" : "brand"}>{appointment.status === "completed" ? "Completed" : relativeDay(appointment.startsAt)}</Badge>
          </p>
          <p className="flex items-center gap-2 text-ink-700">
            <Clock className="size-4 text-ink-400" aria-hidden /> {parts.time}
          </p>
          {appointment.location ? (
            <p className="flex items-center gap-2 text-ink-700">
              <MapPin className="size-4 text-ink-400" aria-hidden /> {appointment.location}
            </p>
          ) : null}
        </div>
        {appointment.location ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(appointment.location)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-50 px-5 font-semibold text-brand-800 hover:bg-brand-100"
          >
            <Navigation className="size-4" aria-hidden /> Directions
          </a>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={CircleHelp} title="My questions" description="Bring this list to the visit." />
          <div className="grid gap-5 px-6 pt-4 pb-6">
            {appointment.questions.length ? (
              <ol className="grid gap-2.5">
                {appointment.questions.map((question, index) => (
                  <li key={`${index}-${question}`} className="flex gap-3 rounded-xl bg-canvas px-4 py-3">
                    <span className="grid size-7 flex-none place-items-center rounded-full bg-white font-display text-[0.85rem] font-bold text-brand-700 ring-1 ring-line">{index + 1}</span>
                    <span className="pt-0.5 text-ink-900">{question}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={CircleHelp} title="No questions yet">
                Add questions as you think of them so nothing is forgotten.
              </EmptyState>
            )}
            {!past ? (
              <ActionForm action={addQuestionAction} submit="Add question" variant="soft" size="sm" resetOnSuccess className="print:hidden">
                <input type="hidden" name="id" value={appointment.id} />
                <Field label="New question" name="question" required placeholder="Is it okay to take my medicines before blood work?" />
              </ActionForm>
            ) : null}
          </div>
        </Card>
        <Card>
          <CardHeader icon={NotebookPen} title="Notes" />
          <div className="px-6 pt-4 pb-6">
            {appointment.notes ? <p className="whitespace-pre-wrap text-ink-800">{appointment.notes}</p> : <p className="text-ink-500">No notes for this visit.</p>}
            <p className="mt-4 text-[0.9rem] text-ink-500">Reminder: {appointment.reminderEnabled ? "on, the day before" : "off"}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
