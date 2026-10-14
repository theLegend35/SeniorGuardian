import { CalendarDays, Plus } from "lucide-react";

import { AppointmentRow } from "@/components/health/records";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";

export const metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  const actor = await requireRole("patient");
  const chart = await (await getStore()).getChart(actor, actor.patientId!);
  const all = (chart.appointments ?? []).filter((item) => item.status !== "archived");
  const now = new Date().toISOString();
  const upcoming = all.filter((item) => item.status === "scheduled" && item.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = all.filter((item) => item.status === "completed" || item.startsAt < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Appointments"
        description="Keep every visit in one place, with your questions ready before you walk in."
        actions={
          <LinkButton href="/patient/appointments/new">
            <Plus className="size-5" aria-hidden /> Add appointment
          </LinkButton>
        }
      />
      <section className="grid gap-3">
        <SectionTitle>Upcoming</SectionTitle>
        {upcoming.length ? (
          <Card className="p-2">
            <div className="grid gap-1">
              {upcoming.map((item) => (
                <AppointmentRow key={item.id} appointment={item} href={`/patient/appointments/${item.id}`} />
              ))}
            </div>
          </Card>
        ) : (
          <EmptyState icon={CalendarDays} title="No upcoming appointments" action={<LinkButton href="/patient/appointments/new">Add an appointment</LinkButton>}>
            Add your next visit to get a reminder and keep your questions in one place.
          </EmptyState>
        )}
      </section>
      {past.length ? (
        <section className="grid gap-3">
          <SectionTitle>Past visits</SectionTitle>
          <Card className="p-2">
            <div className="grid gap-1">
              {past.map((item) => (
                <AppointmentRow key={item.id} appointment={item} href={`/patient/appointments/${item.id}`} />
              ))}
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
