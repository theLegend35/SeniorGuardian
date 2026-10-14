import { CalendarDays } from "lucide-react";

import { AppointmentRow } from "@/components/health/records";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatDate, localDate, relativeDay } from "@/lib/time";

export const metadata = { title: "Schedule" };

export default async function DoctorSchedulePage() {
  const actor = await requireRole("doctor");
  const schedule = await (await getStore()).listSchedule(actor);
  const upcoming = schedule.filter((visit) => visit.status === "scheduled" && new Date(visit.startsAt) >= new Date());
  const days = new Map<string, typeof upcoming>();
  for (const visit of upcoming) {
    const key = localDate(new Date(visit.startsAt));
    days.set(key, [...(days.get(key) ?? []), visit]);
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Schedule" description="Upcoming visits for authorized patients, including the questions they've prepared." />
      {days.size ? (
        [...days.values()].map((visits) => (
          <section key={visits[0].id} className="grid gap-3">
            <h2 className="flex items-baseline gap-3 text-[1.2rem] font-extrabold text-ink-950">
              {formatDate(visits[0].startsAt)}
              <span className="text-[0.92rem] font-semibold text-brand-700">{relativeDay(visits[0].startsAt)}</span>
            </h2>
            <Card className="p-2">
              <div className="grid gap-1">
                {visits.map((visit) => (
                  <div key={visit.id}>
                    <AppointmentRow appointment={visit} patientName={visit.patientName} href={`/doctor/patients/${visit.patientId}#visits`} />
                    {visit.questions.length ? (
                      <ul className="mb-2 ml-[5.5rem] grid gap-1 border-l-2 border-brand-200 pl-4 text-[0.92rem] text-ink-600">
                        {visit.questions.map((question) => (
                          <li key={question}>“{question}”</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ))
      ) : (
        <EmptyState icon={CalendarDays} title="No upcoming visits">
          Visits your authorized patients add will appear here.
        </EmptyState>
      )}
    </div>
  );
}
