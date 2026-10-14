import Link from "next/link";
import { ArrowRight, CalendarDays, HeartHandshake, Pill } from "lucide-react";

import { AccessChips } from "@/components/health/AccessChips";
import { WearablePanel } from "@/components/health/RecordCharts";
import { DoseProgress, DoseRow } from "@/components/health/records";
import { Avatar, Badge, Callout, EmptyState, LinkButton } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import type { DeviceBoard, TodayDose } from "@/lib/data/types";
import { ageFrom, formatDate, formatWhen, greeting, relativeDay } from "@/lib/time";
import type { DeviceReading } from "@/types/domain";

export const metadata = { title: "Overview" };

export default async function CaregiverDashboard() {
  const actor = await requireRole("caregiver");
  const store = await getStore();
  const patients = await store.listPatientCards(actor);
  const doses = new Map<string, TodayDose[]>();
  const boards = new Map<string, DeviceBoard>();
  await Promise.all(
    patients.map(async (patient) => {
      if (patient.access === "full") return;
      if (patient.access.viewMedications) {
        doses.set(patient.patientId, (await store.todayDoses(actor, patient.patientId)).sort((a, b) => a.time.localeCompare(b.time)));
      }
      if (patient.access.viewReadings) boards.set(patient.patientId, await store.getDeviceBoard(actor, patient.patientId));
    }),
  );

  return (
    <div className="grid gap-7">
      <header>
        <p className="text-[0.95rem] font-semibold text-brand-700">{formatDate(new Date().toISOString())}</p>
        <h1 className="text-[2rem] leading-tight font-extrabold text-ink-950 md:text-[2.4rem]">{greeting(actor.fullName)}</h1>
        <p className="mt-1 text-[1.05rem] text-ink-600">Here&apos;s how the people you help are doing today. You see only what each person chose to share.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/caregiver/assistant" className="card flex items-center justify-between gap-3 px-5 py-4 hover:border-brand-300">
          <span>
            <span className="block font-extrabold text-ink-950">Assistant</span>
            <span className="mt-1 block text-ink-600">Explain a shared medicine, visit, or note.</span>
          </span>
          <ArrowRight className="size-5 flex-none text-brand-700" aria-hidden />
        </Link>
        <Link href="/caregiver/finder" className="card flex items-center justify-between gap-3 px-5 py-4 hover:border-brand-300">
          <span>
            <span className="block font-extrabold text-ink-950">Find care</span>
            <span className="mt-1 block text-ink-600">A pharmacy, clinic, or hospital nearby.</span>
          </span>
          <ArrowRight className="size-5 flex-none text-brand-700" aria-hidden />
        </Link>
      </div>

      {patients.length ? (
        <div className="grid gap-6">
          {patients.map((patient) => {
            const access = patient.access === "full" ? null : patient.access;
            const today = doses.get(patient.patientId) ?? [];
            const board = boards.get(patient.patientId);
            const latest = new Map<string, DeviceReading>();
            for (const reading of board?.readings ?? []) {
              if (!latest.has(reading.metric)) latest.set(reading.metric, reading);
            }
            const outside = [...latest.values()].filter((reading) => reading.status === "outside");
            const remaining = today.filter((dose) => !dose.taken).length;
            const age = ageFrom(patient.dateOfBirth);
            return (
              <section key={patient.patientId} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 border-b border-line px-6 py-5">
                  <Avatar name={patient.fullName} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[1.35rem] font-extrabold text-ink-950">{patient.fullName}</h2>
                    <p className="text-ink-500">{age !== null ? `${age} years old` : ""}</p>
                  </div>
                  <LinkButton href={`/caregiver/patients/${patient.patientId}`} variant="secondary">
                    Open<span className="sr-only"> record for {patient.fullName}</span> <ArrowRight className="size-4" aria-hidden />
                  </LinkButton>
                </div>
                <div className="flex flex-wrap gap-2 border-b border-line px-6 py-3 text-[0.92rem]">
                  {access?.viewMedications ? <span className="rounded-full bg-ai-50 px-3 py-1 font-semibold text-ai-700">{remaining} {remaining === 1 ? "dose" : "doses"} left today</span> : null}
                  {access?.viewAppointments ? <span className="rounded-full bg-[#eef4ff] px-3 py-1 font-semibold text-[#1d4ed8]">{patient.nextAppointment ? `Next visit ${relativeDay(patient.nextAppointment)}` : "No visit scheduled"}</span> : null}
                  {access?.viewReadings ? (
                    <span className="rounded-full bg-apricot-50 px-3 py-1 font-semibold text-apricot-700">
                      {latest.size === 0 ? "No device readings yet" : outside.length ? `${outside.length} reading${outside.length === 1 ? "" : "s"} outside a saved range` : "No reading is outside a saved range"}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                  <div className="grid content-start gap-4">
                    <p className="flex items-center gap-2 font-bold text-ink-950">
                      <Pill className="size-5 text-ai-700" aria-hidden /> Today&apos;s medicines
                    </p>
                    {access?.viewMedications ? (
                      today.length ? (
                        <>
                          <DoseProgress doses={today} />
                          <ul className="grid gap-2.5">
                            {today.map((dose) => (
                              <DoseRow key={`${dose.medication.id}-${dose.time}`} dose={dose} canMark={access.manageReminders} />
                            ))}
                          </ul>
                          {!access.manageReminders ? <p className="text-[0.88rem] text-ink-500">You can view doses. {patient.fullName.split(" ")[0]} hasn&apos;t turned on reminder help.</p> : null}
                        </>
                      ) : (
                        <p className="text-ink-500">No doses scheduled today.</p>
                      )
                    ) : (
                      <p className="rounded-xl bg-canvas px-4 py-3 text-ink-500">Medicines aren&apos;t shared with you.</p>
                    )}
                  </div>
                  <div className="grid content-start gap-4">
                    <div>
                      <p className="flex items-center gap-2 font-bold text-ink-950">
                        <CalendarDays className="size-5 text-[#1d4ed8]" aria-hidden /> Next visit
                      </p>
                      {access?.viewAppointments ? (
                        patient.nextAppointment ? (
                          <p className="mt-2 rounded-xl bg-canvas px-4 py-3">
                            <span className="block font-semibold text-ink-950">{formatWhen(patient.nextAppointment)}</span>
                            <Badge tone="brand" className="mt-1">
                              {relativeDay(patient.nextAppointment)}
                            </Badge>
                          </p>
                        ) : (
                          <p className="mt-2 text-ink-500">Nothing scheduled.</p>
                        )
                      ) : (
                        <p className="mt-2 rounded-xl bg-canvas px-4 py-3 text-ink-500">Appointments aren&apos;t shared with you.</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-2 text-[0.88rem] font-semibold text-ink-500">What {patient.fullName.split(" ")[0]} shares with you</p>
                      <AccessChips access={patient.access} />
                    </div>
                  </div>
                </div>
                <div className="border-t border-line px-6 py-5">
                  <p className="font-bold text-ink-950">Device readings</p>
                  {access?.viewReadings && board ? (
                    latest.size ? (
                      <WearablePanel board={board} />
                    ) : (
                      <p className="mt-2 text-ink-500">No device readings yet. If a ring or watch stops sending numbers, this line says it is offline.</p>
                    )
                  ) : (
                    <p className="mt-2 rounded-xl bg-canvas px-4 py-3 text-ink-500">Device readings aren&apos;t shared with you.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={HeartHandshake} title="No one has connected with you yet">
          Ask your family member to invite you from their Care team page using your email address.
        </EmptyState>
      )}

      <Callout tone="brand" title="Your access is set by them">
        Each person chooses which sections you can see and can change it at any time. <Link href="/caregiver/patients" className="font-semibold underline">See everyone you help</Link>.
      </Callout>
    </div>
  );
}
