import { notFound } from "next/navigation";
import { Archive, BellOff, BellRing, CalendarClock, Check, History, ImageIcon, Pencil, Sparkles } from "lucide-react";

import { DoseRow, fileUrl } from "@/components/health/records";
import { MedicationForm } from "@/components/health/MedicationForm";
import { InlineAction } from "@/components/ui/InlineAction";
import { AiBlock, Badge, Callout, Card, CardHeader, FormattedText, KeyValue, LinkButton, PageHeader, SourceBlock } from "@/components/ui/primitives";
import { archiveMedicationAction, explainMedicationAction } from "@/lib/actions/health";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import { formatWhen, shortDate } from "@/lib/time";
import type { MedicationEventKind } from "@/types/domain";

export const metadata = { title: "Medicine" };

const EVENT_LABEL: Record<MedicationEventKind, string> = {
  taken: "Taken",
  missed: "Missed",
  reminder_set: "Reminder set",
  added: "Added",
  updated: "Updated",
  archived: "Stopped",
};

export default async function MedicationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string; added?: string; saved?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actor = await requireRole("patient");
  const store = await getStore();
  const detail = await store.getMedication(actor, id).catch((error) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });
  const { medication, prescription, events } = detail;
  const doses = (await store.todayDoses(actor, actor.patientId!)).filter((dose) => dose.medication.id === medication.id);
  const active = medication.status === "active";
  const original = prescription?.sourceText || medication.instructions;
  const history = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);

  if (query.edit && active) {
    return (
      <div className="mx-auto grid max-w-3xl gap-6">
        <PageHeader back={{ href: `/patient/medications/${medication.id}`, label: medication.name }} title="Edit medicine" description="If the prescription changed, copy the new instructions exactly as written." />
        <MedicationForm
          id={medication.id}
          initial={{
            name: medication.name,
            instructions: medication.instructions,
            frequency: medication.frequency,
            times: medication.times,
            startDate: medication.startDate,
            endDate: medication.endDate,
            prescribingProvider: medication.prescribingProvider,
            notes: medication.notes,
            reminderEnabled: medication.reminderEnabled,
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        back={{ href: "/patient/medications", label: "Medicines" }}
        title={<span translate="no">{medication.name}</span>}
        description={[medication.frequency, medication.prescribingProvider && `Prescribed by ${medication.prescribingProvider}`].filter(Boolean).join(" · ")}
        actions={
          active ? (
            <>
              <LinkButton href={`/patient/medications/${medication.id}?edit=1`} variant="secondary">
                <Pencil className="size-4" aria-hidden /> Edit
              </LinkButton>
              <InlineAction action={archiveMedicationAction} fields={{ id: medication.id }} variant="danger" size="md" pending="Stopping…" confirm={`Move ${medication.name} to past medicines? Its history is kept.`}>
                <Archive className="size-4" aria-hidden /> Stop taking
              </InlineAction>
            </>
          ) : (
            <Badge tone="neutral" icon={Archive}>
              Past medicine
            </Badge>
          )
        }
      />

      {query.added ? <Callout tone="success" title="Medicine saved">It&apos;s on your list{medication.reminderEnabled ? " and reminders are on" : ""}.</Callout> : null}
      {query.saved ? <Callout tone="success" title="Changes saved">If you changed the instructions, ask for a fresh explanation below.</Callout> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <SourceBlock label="Original prescription" meta="Source of truth">
            {original}
          </SourceBlock>
          {prescription?.fileId ? (
            <figure className="overflow-hidden rounded-2xl border border-line-strong bg-white">
              <figcaption className="flex items-center gap-1.5 border-b border-line bg-canvas px-4 py-2 text-[0.8rem] font-bold tracking-wide text-ink-700 uppercase">
                <ImageIcon className="size-3.5" aria-hidden /> Label photo
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(prescription.fileId)} alt={`Pharmacy label for ${medication.name}`} className="max-h-80 w-full bg-canvas object-contain" />
            </figure>
          ) : null}
        </div>
        <div className="grid content-start gap-3">
          {prescription?.aiExplanation ? (
            <>
              <AiBlock meta="Does not replace the label">
                <FormattedText text={prescription.aiExplanation} />
              </AiBlock>
              <InlineAction action={explainMedicationAction} fields={{ id: medication.id }} variant="ghost" pending="Explaining…">
                <Sparkles className="size-4" aria-hidden /> Explain again
              </InlineAction>
            </>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-ai-200 bg-ai-50/50 p-5">
              <p className="flex items-center gap-2 font-bold text-ink-950">
                <Sparkles className="size-5 text-ai-600" aria-hidden /> Explain this in plain language
              </p>
              <p className="text-[0.95rem] text-ink-600">Get a simple explanation of the words on this label. Your original label won&apos;t change.</p>
              {prescription ? (
                <InlineAction action={explainMedicationAction} fields={{ id: medication.id }} variant="soft" pending="Explaining…">
                  <Sparkles className="size-4" aria-hidden /> Explain this label
                </InlineAction>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={CalendarClock} title="Today" description={medication.reminderEnabled ? "Reminders are on" : "Reminders are off"} action={medication.reminderEnabled ? <BellRing className="size-5 text-brand-600" aria-hidden /> : <BellOff className="size-5 text-ink-400" aria-hidden />} />
          <div className="px-6 pt-4 pb-6">
            {active && doses.length ? (
              <ul className="grid gap-2.5">
                {doses.map((dose) => (
                  <DoseRow key={dose.time} dose={dose} canMark />
                ))}
              </ul>
            ) : (
              <p className="text-ink-500">{active ? "No reminder times are set." : "This medicine is no longer active."}</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader icon={Check} title="Details" />
          <div className="px-6 pt-4 pb-6">
            <KeyValue
              columns={1}
              items={[
                ["How often", medication.frequency],
                ["Started", medication.startDate ? shortDate(`${medication.startDate}T12:00:00`) : ""],
                ["Ends", medication.endDate ? shortDate(`${medication.endDate}T12:00:00`) : "Ongoing"],
                ["My notes", medication.notes],
              ]}
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={History} title="History" description="Every change and dose is recorded." />
        <ul className="grid gap-0 px-6 pt-3 pb-5">
          {history.map((event) => (
            <li key={event.id} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
              <Badge tone={event.kind === "taken" ? "success" : event.kind === "missed" ? "warning" : event.kind === "archived" ? "neutral" : "ai"}>{EVENT_LABEL[event.kind]}</Badge>
              <span className="min-w-0 flex-1 text-[0.95rem] text-ink-700">{event.note}</span>
              <span className="flex-none text-[0.85rem] text-ink-500">{formatWhen(event.kind === "taken" || event.kind === "missed" ? (event.scheduledFor ?? event.createdAt) : event.createdAt)}</span>
            </li>
          ))}
          {!history.length ? <li className="text-ink-500">No activity yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
