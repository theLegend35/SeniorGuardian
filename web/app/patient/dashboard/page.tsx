import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  HeartPulse,
  MapPin,
  MessageCircleHeart,
  Phone,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  Watch,
  type LucideIcon,
} from "lucide-react";

import { MetricGauges } from "@/components/health/MetricGauge";
import { AppointmentRow, DoseProgress, DoseRow, TimelineList, patientEventHref } from "@/components/health/records";
import { Avatar, Badge, Callout, Card, CardHeader, Disclaimer, EmptyState, LinkButton, cx } from "@/components/ui/primitives";
import { METRICS } from "@/lib/devices/metrics";
import { devicePresence, EXAMPLE_OURA_ID } from "@/lib/devices/presence";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatDate, greeting, timeAgo } from "@/lib/time";

export const metadata = { title: "Today" };

const QUICK: Array<{ href: string; label: string; body: string; icon: LucideIcon; tone: string }> = [
  { href: "/patient/assistant", label: "Ask the assistant", body: "Type or speak a question", icon: MessageCircleHeart, tone: "bg-brand-700 text-white" },
  { href: "/patient/concerns/new", label: "Check a concern", body: "Describe it, add a photo", icon: HeartPulse, tone: "bg-apricot-50 text-apricot-700" },
  { href: "/patient/medications/new", label: "Add a medicine", body: "Scan or type a label", icon: Pill, tone: "bg-ai-50 text-ai-700" },
  { href: "/patient/finder", label: "Find care nearby", body: "Urgent care, pharmacies", icon: MapPin, tone: "bg-[#eef4ff] text-[#1d4ed8]" },
];

export default async function PatientDashboard() {
  const actor = await requireRole("patient");
  const store = await getStore();
  const patientId = actor.patientId!;
  const [chart, doses, notifications, devices] = await Promise.all([
    store.getChart(actor, patientId),
    store.todayDoses(actor, patientId),
    store.listNotifications(actor),
    store.getDeviceBoard(actor, patientId),
  ]);
  const flagged = devices.readings.find((reading) => reading.status === "outside");
  const sortedDoses = [...doses].sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = (chart.appointments ?? [])
    .filter((item) => item.status === "scheduled" && new Date(item.startsAt) >= new Date())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const unread = notifications.filter((item) => !item.read).slice(0, 3);
  const team = chart.careTeam;
  const doctors = team?.doctors.filter((item) => item.status === "active") ?? [];
  const caregivers = team?.caregivers.filter((item) => item.status === "active") ?? [];
  const remaining = sortedDoses.filter((dose) => !dose.taken).length;
  const device = devices.connections.find((item) => devices.readings.some((reading) => reading.connectionId === item.id));
  const deviceReadings = device ? devices.readings.filter((reading) => reading.connectionId === device.id) : [];
  const presence = device ? devicePresence(device.label, deviceReadings, Date.now(), device.id === EXAMPLE_OURA_ID) : null;
  const latestDevice = new Map<string, (typeof deviceReadings)[number]>();
  for (const reading of deviceReadings) {
    if (!latestDevice.has(reading.metric)) latestDevice.set(reading.metric, reading);
  }
  const deviceGauges = [...latestDevice.values()].map((reading) => {
    const range = devices.ranges.find((item) => item.metric === reading.metric);
    return { metric: reading.metric, value: reading.value, unit: reading.unit, status: reading.status, low: range?.low ?? null, high: range?.high ?? null };
  });

  return (
    <div className="grid gap-7">
      <header className="flex flex-col gap-1">
        <p className="text-[0.95rem] font-semibold text-brand-700">{formatDate(new Date().toISOString())}</p>
        <h1 className="text-[2rem] leading-tight font-extrabold text-ink-950 md:text-[2.4rem]">{greeting(actor.fullName)}</h1>
        <p className="text-[1.05rem] text-ink-600">
          {remaining === 0 && sortedDoses.length
            ? "All of today's medicines are marked taken. Nice work."
            : remaining
              ? `You have ${remaining} ${remaining === 1 ? "dose" : "doses"} left today${next ? `, and your next visit is with ${next.provider}` : ""}.`
              : "Here's your day at a glance."}
        </p>
      </header>

      {flagged ? (
        <Callout tone="warning" title="A device reading is outside the saved range">
          {METRICS[flagged.metric].label} was {flagged.value} {flagged.unit}. This is a signal to look, not a diagnosis.{" "}
          <Link href="/patient/devices" className="font-semibold underline">
            Open devices
          </Link>
          . If you feel unwell, contact a clinician. In an emergency, call 911.
        </Callout>
      ) : null}

      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "group flex flex-col gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 sm:flex-row sm:items-center",
              index === 0 ? "border-brand-700 bg-brand-700 text-white shadow-raised hover:bg-brand-800" : "card hover:shadow-raised",
            )}
          >
            <span className={cx("grid size-11 flex-none place-items-center rounded-xl", index === 0 ? "bg-white/15 text-white" : item.tone)}>
              <item.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className={cx("block font-bold", index === 0 ? "text-white" : "text-ink-950")}>{item.label}</span>
              <span className={cx("block text-[0.86rem]", index === 0 ? "text-brand-100" : "text-ink-500")}>{item.body}</span>
            </span>
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader
              icon={Pill}
              title="Today's medicines"
              description="Tap Mark taken after each dose."
              action={
                <LinkButton href="/patient/medications" variant="ghost" size="sm">
                  All medicines <ArrowRight className="size-4" aria-hidden />
                </LinkButton>
              }
            />
            <div className="grid gap-4 px-6 pt-4 pb-6">
              {sortedDoses.length ? (
                <>
                  <DoseProgress doses={sortedDoses} />
                  <ul className="grid gap-2.5">
                    {sortedDoses.map((dose) => (
                      <DoseRow key={`${dose.medication.id}-${dose.time}`} dose={dose} canMark detailHref={`/patient/medications/${dose.medication.id}`} />
                    ))}
                  </ul>
                </>
              ) : (
                <EmptyState icon={Pill} title="No medicines scheduled today" action={<LinkButton href="/patient/medications/new" size="sm">Add a medicine</LinkButton>}>
                  Add a medicine with reminder times to see it here.
                </EmptyState>
              )}
            </div>
          </Card>

          {deviceGauges.length ? (
            <Card>
              <CardHeader
                icon={Watch}
                title={device?.label || "Devices"}
                description={presence?.detail}
                action={
                  <LinkButton href="/patient/devices" variant="ghost" size="sm">
                    Devices <ArrowRight className="size-4" aria-hidden />
                  </LinkButton>
                }
              />
              <div className="px-6 pt-2 pb-6">
                <p className={presence?.on ? "mb-3 font-semibold text-brand-800" : "mb-3 font-semibold text-apricot-700"}>{presence?.headline}</p>
                <MetricGauges metrics={deviceGauges} />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              icon={CalendarDays}
              title="Coming up"
              action={
                <LinkButton href="/patient/appointments" variant="ghost" size="sm">
                  Schedule <ArrowRight className="size-4" aria-hidden />
                </LinkButton>
              }
            />
            <div className="px-3 pt-2 pb-4">
              {upcoming.length ? (
                <div className="grid gap-1">
                  {upcoming.slice(0, 3).map((item) => (
                    <AppointmentRow key={item.id} appointment={item} href={`/patient/appointments/${item.id}`} />
                  ))}
                </div>
              ) : (
                <div className="px-3">
                  <EmptyState icon={CalendarDays} title="No upcoming visits" action={<LinkButton href="/patient/appointments/new" size="sm">Add an appointment</LinkButton>} />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={ShieldCheck}
              title="Recent activity"
              action={
                <LinkButton href="/patient/timeline" variant="ghost" size="sm">
                  Timeline <ArrowRight className="size-4" aria-hidden />
                </LinkButton>
              }
            />
            <div className="px-6 pt-3 pb-3">
              <TimelineList events={(chart.timeline ?? []).slice(0, 4)} hrefFor={patientEventHref} compact />
            </div>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader
              icon={Bell}
              title="Alerts"
              action={unread.length ? <Badge tone="apricot">{unread.length} new</Badge> : null}
            />
            <div className="px-6 pt-3 pb-5">
              {unread.length ? (
                <ul className="grid gap-3">
                  {unread.map((item) => (
                    <li key={item.id} className="rounded-xl bg-canvas px-4 py-3">
                      <p className="font-bold text-ink-950">{item.title}</p>
                      <p className="mt-0.5 text-[0.92rem] text-ink-600">{item.body}</p>
                      <p className="mt-1 text-[0.8rem] text-ink-400">{timeAgo(item.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-500">You&apos;re all caught up.</p>
              )}
              <LinkButton href="/patient/notifications" variant="secondary" size="sm" full className="mt-4">
                See all alerts
              </LinkButton>
            </div>
          </Card>

          <section className="overflow-hidden rounded-[1.25rem] bg-brand-950 text-white shadow-card">
            <div className="px-6 pt-5">
              <p className="flex items-center gap-2 text-[0.85rem] font-bold tracking-wide text-brand-200 uppercase">
                <ShieldCheck className="size-4" aria-hidden /> Emergency information
              </p>
            </div>
            <dl className="grid gap-3 px-6 pt-4 pb-5">
              {[
                ["Allergies", chart.patient.allergies || "None recorded"],
                ["Conditions", chart.patient.conditions || "None recorded"],
                ["Blood type", chart.patient.bloodType || "Not added"],
                ["Emergency contact", chart.patient.emergencyContact || "Not added"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[0.8rem] font-semibold text-brand-200/80">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2 border-t border-white/10 px-6 py-4">
              <a href="tel:911" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger-600 font-bold text-white hover:bg-danger-700">
                <Phone className="size-4" aria-hidden /> Call 911
              </a>
              <Link href="/patient/health" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/15">
                Edit
              </Link>
            </div>
          </section>

          <Card>
            <CardHeader
              icon={Users}
              title="Care team"
              action={
                <LinkButton href="/patient/care-team" variant="ghost" size="sm">
                  Manage
                </LinkButton>
              }
            />
            <ul className="grid gap-3 px-6 pt-4 pb-5">
              {doctors.map((doctor) => (
                <li key={doctor.linkId} className="flex items-center gap-3">
                  <Avatar name={doctor.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink-950">{doctor.name}</span>
                    <span className="block truncate text-[0.88rem] text-ink-500">{doctor.specialty || "Clinician"}</span>
                  </span>
                  <Stethoscope className="size-4 text-ink-400" aria-label="Clinician" />
                </li>
              ))}
              {caregivers.map((caregiver) => (
                <li key={caregiver.permissionId} className="flex items-center gap-3">
                  <Avatar name={caregiver.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink-950">{caregiver.name}</span>
                    <span className="block truncate text-[0.88rem] text-ink-500">{caregiver.relationship || "Caregiver"}</span>
                  </span>
                  <Users className="size-4 text-ink-400" aria-label="Caregiver" />
                </li>
              ))}
              {!doctors.length && !caregivers.length ? <p className="text-ink-500">No one has access to your record yet.</p> : null}
            </ul>
          </Card>

          <Disclaimer compact className="px-1" />
        </div>
      </div>
    </div>
  );
}
