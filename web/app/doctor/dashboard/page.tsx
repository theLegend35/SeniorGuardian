import Link from "next/link";
import { ArrowRight, Bell, CalendarDays, HeartPulse, TriangleAlert, UsersRound } from "lucide-react";

import { QuickStats } from "@/components/health/QuickStats";
import { AppointmentRow } from "@/components/health/records";
import { PatientTable } from "@/components/health/PatientTable";
import { Avatar, Card, CardHeader, EmptyState, LinkButton, Stat, UrgencyBadge } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { wearableQuickStats } from "@/lib/devices/quick-stats";
import { todaysAlerts } from "@/lib/notifications/today";
import { daysUntil, formatDate, greeting, timeAgo } from "@/lib/time";

export const metadata = { title: "Dashboard" };

export default async function DoctorDashboard() {
  const actor = await requireRole("doctor");
  const store = await getStore();
  const [patients, schedule, notifications] = await Promise.all([store.listPatientCards(actor), store.listSchedule(actor), store.listNotifications(actor)]);
  const upcoming = schedule.filter((visit) => visit.status === "scheduled" && new Date(visit.startsAt) >= new Date());
  const thisWeek = upcoming.filter((visit) => daysUntil(visit.startsAt) < 7);
  const recentConcerns = patients.filter((patient) => patient.latestConcern && daysUntil(patient.latestConcern.createdAt) > -14);
  const attention = patients
    .filter((patient) => patient.latestConcern && (patient.latestConcern.urgency === "emergency" || patient.latestConcern.urgency === "prompt" || daysUntil(patient.latestConcern.createdAt) > -7))
    .sort((a, b) => (b.latestConcern?.createdAt ?? "").localeCompare(a.latestConcern?.createdAt ?? ""));
  const unread = todaysAlerts(notifications).filter((item) => !item.read).length;
  const surname = actor.fullName.replace(/,.*$/, "").split(" ").at(-1);
  const boards = await Promise.all(patients.map(async (patient) => ({ patientId: patient.patientId, fullName: patient.fullName, board: await store.getDeviceBoard(actor, patient.patientId) })));
  const wearableStats = wearableQuickStats(boards);

  return (
    <div className="grid gap-7">
      <header>
        <p className="text-[0.95rem] font-semibold text-brand-700">{formatDate(new Date().toISOString())}</p>
        <h1 className="text-[2rem] leading-tight font-extrabold text-ink-950 md:text-[2.4rem]">{greeting("").replace(/,\s*$/, `, Dr. ${surname}`)}</h1>
        <p className="mt-1 text-[1.05rem] text-ink-600">Only patients who have authorized you appear here. Concerns are visible only when the patient shares them.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={UsersRound} label="Authorized patients" value={patients.length} />
        <Stat icon={HeartPulse} label="Shared concerns" value={recentConcerns.length} hint="Last 14 days" tone="apricot" />
        <Stat icon={CalendarDays} label="Visits this week" value={thisWeek.length} tone="ai" />
        <Stat icon={Bell} label="Unread alerts" value={unread} tone={unread ? "danger" : "brand"} />
      </div>

      <QuickStats stats={wearableStats} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader icon={TriangleAlert} title="Needs attention" description="Recently shared concerns, most recent first." />
            <div className="px-6 pt-4 pb-6">
              {attention.length ? (
                <ul className="grid gap-3">
                  {attention.map((patient) => (
                    <li key={patient.patientId}>
                      <Link href={`/doctor/patients/${patient.patientId}#concerns`} className="flex items-start gap-4 rounded-2xl border border-line p-4 transition-shadow hover:shadow-raised">
                        <Avatar name={patient.fullName} />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-ink-950">{patient.fullName}</span>
                            <UrgencyBadge urgency={patient.latestConcern!.urgency} />
                          </span>
                          <span className="mt-1 line-clamp-2 block text-ink-700">“{patient.latestConcern!.description}”</span>
                          <span className="mt-1 block text-[0.85rem] text-ink-500">Shared {timeAgo(patient.latestConcern!.createdAt)}</span>
                        </span>
                        <ArrowRight className="mt-1 size-5 flex-none text-ink-400" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={HeartPulse} title="Nothing new">
                  No recently shared concerns.
                </EmptyState>
              )}
            </div>
          </Card>

          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.3rem] font-extrabold text-ink-950">Patients</h2>
              <LinkButton href="/doctor/records" variant="ghost" size="sm">
                Records <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
            </div>
            {patients.length ? (
              <PatientTable patients={patients} base="/doctor/patients" compact />
            ) : (
              <EmptyState icon={UsersRound} title="No authorized patients yet">
                Patients add you from their Care team page using your email address.
              </EmptyState>
            )}
          </section>
        </div>

        <Card className="content-start">
          <CardHeader
            icon={CalendarDays}
            title="Upcoming visits"
            action={
              <LinkButton href="/doctor/appointments" variant="ghost" size="sm">
                Schedule
              </LinkButton>
            }
          />
          <div className="px-3 pt-2 pb-4">
            {upcoming.length ? (
              <div className="grid gap-1">
                {upcoming.slice(0, 6).map((visit) => (
                  <AppointmentRow key={visit.id} appointment={visit} patientName={visit.patientName} href={`/doctor/patients/${visit.patientId}#visits`} />
                ))}
              </div>
            ) : (
              <p className="px-3 text-ink-500">No upcoming visits.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
