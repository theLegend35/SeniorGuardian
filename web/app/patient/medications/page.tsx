import Link from "next/link";
import { Archive, BellOff, BellRing, ChevronRight, Clock, Pill, Plus } from "lucide-react";

import { Badge, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatTime, shortDate } from "@/lib/time";

export const metadata = { title: "Medicines" };

export default async function MedicationsPage() {
  const actor = await requireRole("patient");
  const store = await getStore();
  const [chart, doses] = await Promise.all([store.getChart(actor, actor.patientId!), store.todayDoses(actor, actor.patientId!)]);
  const meds = chart.medications ?? [];
  const active = meds.filter((med) => med.status === "active").sort((a, b) => (a.times[0] ?? "").localeCompare(b.times[0] ?? ""));
  const archived = meds.filter((med) => med.status === "archived");

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Medicines"
        description="Your saved prescriptions, reminder times, and what you've taken today. The original label text is always kept."
        actions={
          <LinkButton href="/patient/medications/new">
            <Plus className="size-5" aria-hidden /> Add medicine
          </LinkButton>
        }
      />

      {active.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {active.map((med) => {
            const today = doses.filter((dose) => dose.medication.id === med.id);
            const taken = today.filter((dose) => dose.taken).length;
            return (
              <li key={med.id}>
                <Link href={`/patient/medications/${med.id}`} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-raised">
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 flex-none place-items-center rounded-2xl bg-ai-50 text-ai-700">
                      <Pill className="size-6" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p translate="no" className="text-[1.15rem] font-bold text-ink-950 group-hover:text-brand-800">{med.name}</p>
                      <p className="text-[0.9rem] text-ink-500">
                        {med.frequency}
                        {med.prescribingProvider ? ` · ${med.prescribingProvider}` : ""}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 flex-none text-ink-400" aria-hidden />
                  </div>
                  <p translate="no" className="mt-4 flex-1 rounded-xl bg-canvas px-3.5 py-2.5 text-[0.95rem] text-ink-800">“{med.instructions}”</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {med.times.map((time) => (
                      <span key={time} className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-[0.85rem] font-semibold text-ink-700">
                        <Clock className="size-3.5" aria-hidden /> {formatTime(time)}
                      </span>
                    ))}
                    <span className="ml-auto flex items-center gap-2">
                      {med.reminderEnabled ? (
                        <BellRing className="size-4 text-brand-600" aria-label="Reminders on" />
                      ) : (
                        <BellOff className="size-4 text-ink-400" aria-label="Reminders off" />
                      )}
                      {today.length ? (
                        <Badge tone={taken === today.length ? "success" : "neutral"}>
                          {taken}/{today.length} today
                        </Badge>
                      ) : null}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Pill} title="No medicines yet" action={<LinkButton href="/patient/medications/new">Add your first medicine</LinkButton>}>
          Scan a pharmacy label or type it in. You can set reminder times for each one.
        </EmptyState>
      )}

      {archived.length ? (
        <section className="grid gap-3">
          <SectionTitle>Past medicines</SectionTitle>
          <ul className="card divide-y divide-line">
            {archived.map((med) => (
              <li key={med.id}>
                <Link href={`/patient/medications/${med.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-canvas">
                  <Archive className="size-5 flex-none text-ink-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span translate="no" className="block font-semibold text-ink-800">{med.name}</span>
                    <span className="block text-[0.88rem] text-ink-500">
                      Stopped {shortDate(med.endDate ?? med.updatedAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-ink-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
