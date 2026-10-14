import { notFound } from "next/navigation";
import { Activity, BellPlus, CalendarDays, HeartPulse, Pill } from "lucide-react";

import { AccessChips } from "@/components/health/AccessChips";
import { DeviceReadingList } from "@/components/health/DeviceDesk";
import { MetricHistory } from "@/components/health/RecordCharts";
import { MedicationTable, NoteList, VisitList } from "@/components/health/ChartSections";
import { ConcernReview, DoseProgress, DoseRow, LockedSection, TimelineList } from "@/components/health/records";
import { ActionForm } from "@/components/ui/forms";
import { Avatar, Card, CardHeader, EmptyState, Field, PageHeader, SectionTitle, Select } from "@/components/ui/primitives";
import { addReminderAction } from "@/lib/actions/health";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { ageFrom, formatWhen } from "@/lib/time";

export const metadata = { title: "Shared record" };

export default async function CaregiverPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireRole("caregiver");
  const store = await getStore();
  const chart = await store.getChart(actor, id).catch((error) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });
  const access = chart.access === "full" ? null : chart.access;
  const doses = chart.medications ? (await store.todayDoses(actor, id)).sort((a, b) => a.time.localeCompare(b.time)) : [];
  const activeMeds = (chart.medications ?? []).filter((med) => med.status === "active");
  const first = chart.profile.fullName.split(" ")[0];
  const age = ageFrom(chart.patient.dateOfBirth);
  const board = access?.viewReadings ? await store.getDeviceBoard(actor, id) : null;

  return (
    <div className="grid gap-7">
      <PageHeader back={{ href: "/caregiver/patients", label: "People I help" }} title={chart.profile.fullName} />
      <section className="card flex flex-wrap items-center gap-5 p-6">
        <Avatar name={chart.profile.fullName} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-ink-600">{age !== null ? `${age} years old` : ""}</p>
          <p className="mt-2 mb-1 text-[0.88rem] font-semibold text-ink-500">{first} shares with you:</p>
          <AccessChips access={chart.access} />
        </div>
      </section>

      <section className="grid gap-3">
        <SectionTitle>Device readings</SectionTitle>
        {board ? (
          <div className="grid gap-4">
            <DeviceReadingList board={board} />
            <MetricHistory board={board} />
          </div>
        ) : (
          <LockedSection title="Device readings" />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="grid content-start gap-4">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Pill className="size-5 text-ai-700" aria-hidden /> Today&apos;s medicines
            </span>
          </SectionTitle>
          {chart.medications ? (
            <Card className="grid gap-4 p-5">
              {doses.length ? (
                <>
                  <DoseProgress doses={doses} />
                  <ul className="grid gap-2.5">
                    {doses.map((dose) => (
                      <DoseRow key={`${dose.medication.id}-${dose.time}`} dose={dose} canMark={chart.canManageReminders} />
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-ink-500">No doses scheduled today.</p>
              )}
            </Card>
          ) : (
            <LockedSection title="Medicines" />
          )}
        </section>

        <section className="grid content-start gap-4">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <BellPlus className="size-5 text-brand-700" aria-hidden /> Add a reminder
            </span>
          </SectionTitle>
          {chart.canManageReminders && activeMeds.length ? (
            <Card className="p-5">
              <ActionForm action={addReminderAction} submit="Add reminder" resetOnSuccess>
                <Select label="Medicine" name="medicationId" required>
                  {activeMeds.map((med) => (
                    <option key={med.id} value={med.id}>
                      {med.name}
                    </option>
                  ))}
                </Select>
                <Field label="Reminder time" name="time" type="time" required defaultValue="12:00" />
                <p className="text-[0.88rem] text-ink-500">Adds a reminder only. The prescription instructions can&apos;t be changed by caregivers.</p>
              </ActionForm>
            </Card>
          ) : (
            <LockedSection title="Reminder help" />
          )}
        </section>
      </div>

      {chart.medications ? (
        <section className="grid gap-4">
          <SectionTitle>Medicine list</SectionTitle>
          <MedicationTable medications={chart.medications} prescriptions={chart.prescriptions ?? []} events={chart.medicationEvents ?? []} />
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="grid content-start gap-4">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <CalendarDays className="size-5 text-[#1d4ed8]" aria-hidden /> Appointments
            </span>
          </SectionTitle>
          {chart.appointments ? <VisitList chart={chart} /> : <LockedSection title="Appointments" />}
        </section>
        <section className="grid content-start gap-4">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <Activity className="size-5 text-brand-700" aria-hidden /> Timeline
            </span>
          </SectionTitle>
          {access?.viewTimeline && chart.timeline ? (
            <Card className="px-6 pt-4 pb-3">
              {chart.timeline.length ? <TimelineList events={chart.timeline.slice(0, 10)} compact /> : <p className="pb-3 text-ink-500">No activity yet.</p>}
            </Card>
          ) : (
            <LockedSection title="Timeline" />
          )}
        </section>
      </div>

      {access?.viewTimeline && chart.notes ? (
        <section className="grid gap-4">
          <SectionTitle>Clinician notes</SectionTitle>
          <NoteList chart={chart} />
        </section>
      ) : null}

      <section className="grid gap-4">
        <SectionTitle>
          <span className="flex items-center gap-2">
            <HeartPulse className="size-5 text-apricot-700" aria-hidden /> Shared health concerns
          </span>
        </SectionTitle>
        {chart.concerns ? (
          chart.concerns.length ? (
            chart.concerns
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((concern) => (
                <Card key={concern.id} className="p-5">
                  <p className="mb-4 text-[0.9rem] font-semibold text-ink-500">{formatWhen(concern.createdAt)}</p>
                  <ConcernReview concern={concern} authorLabel={`${first}'s own words`} />
                </Card>
              ))
          ) : (
            <EmptyState icon={HeartPulse} title="No shared concerns" />
          )
        ) : (
          <LockedSection title="Health concerns" />
        )}
      </section>
    </div>
  );
}
