import { notFound } from "next/navigation";
import { Activity, CalendarDays, FileText, HeartPulse, NotebookPen, Pill, ShieldCheck, TriangleAlert, Watch } from "lucide-react";

import { DocumentList, MedicationTable, NoteList, VisitList } from "@/components/health/ChartSections";
import { RecordDesk } from "@/components/health/RecordDesk";
import { RecordReview } from "@/components/health/RecordReview";
import { DeviceReadingList } from "@/components/health/DeviceDesk";
import { MetricHistory } from "@/components/health/RecordCharts";
import { ConcernReview, TimelineList } from "@/components/health/records";
import { ActionForm } from "@/components/ui/forms";
import { AiBlock, Avatar, Badge, Callout, Card, CardHeader, EmptyState, KeyValue, PageHeader, SectionTitle, Stat } from "@/components/ui/primitives";
import { addDoctorNoteAction } from "@/lib/actions/health";
import { summarizeActivity } from "@/lib/ai/summary";
import { AccessError } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import type { PatientChart } from "@/lib/data/types";
import { markedQuotes, reviewStatus } from "@/lib/documents/review-status";
import { wearableQuickStats } from "@/lib/devices/quick-stats";
import { ageFrom, formatWhen, shortDate } from "@/lib/time";

export const metadata = { title: "Patient record" };

function SummaryCard({ chart }: { chart: PatientChart }) {
  const summary = summarizeActivity({
    patientName: chart.profile.fullName,
    concerns: (chart.concerns ?? [])
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({ description: item.description, createdAt: item.createdAt, shared: item.sharedWithCareTeam })),
    medications: (chart.medications ?? []).map((item) => ({ name: item.name, instructions: item.instructions, status: item.status })),
    appointments: (chart.appointments ?? []).map((item) => ({ provider: item.provider, startsAt: item.startsAt, status: item.status })),
    notes: (chart.notes ?? []).map((item) => ({ body: item.body, createdAt: item.createdAt })),
  });
  return (
    <AiBlock label="Activity summary" meta="Built from the entries below">
      <div className="grid gap-3">
        <p className="text-[1.02rem] text-ink-900">{summary.overview}</p>
        {summary.points.length ? (
          <ul className="grid gap-1.5">
            {summary.points.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-[0.6em] size-1.5 flex-none rounded-full bg-ai-600" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        ) : null}
        {summary.followUps.length ? (
          <div className="rounded-xl bg-white/80 px-3.5 py-3 ring-1 ring-ai-200">
            <p className="text-[0.8rem] font-bold tracking-wide text-ai-700 uppercase">Open items</p>
            <ul className="mt-1 grid gap-1">
              {summary.followUps.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="border-t border-ai-200/70 pt-2.5 text-[0.85rem] text-ink-500">Organizational summary only — not a diagnosis. Verify against the original entries below.</p>
      </div>
    </AiBlock>
  );
}

const SECTIONS = [
  ["readings", "Readings"],
  ["concerns", "Concerns"],
  ["medicines", "Medicines"],
  ["visits", "Visits"],
  ["timeline", "Timeline"],
  ["documents", "Documents"],
  ["notes", "Notes"],
] as const;

export default async function DoctorPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireRole("doctor");
  const chart = await (await getStore()).getChart(actor, id).catch((error) => {
    if (error instanceof AccessError) notFound();
    throw error;
  });
  const { patient, profile } = chart;
  const age = ageFrom(patient.dateOfBirth);
  const concerns = [...(chart.concerns ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const devices = await (await getStore()).getDeviceBoard(actor, id);
  const documents = chart.documents ?? [];
  const status = reviewStatus(documents);
  const marked = markedQuotes(documents).length;
  const outside = wearableQuickStats([{ patientId: id, fullName: profile.fullName, board: devices }])[0]?.metrics.filter((metric) => metric.status === "outside").length ?? 0;

  return (
    <div className="grid gap-7">
      <PageHeader back={{ href: "/doctor/patients", label: "Patients" }} title={profile.fullName} />

      <section className="card grid gap-5 p-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <Avatar name={profile.fullName} size="lg" />
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {patient.fictional ? <Badge tone="apricot">Sample record</Badge> : null}
            <Badge tone="brand" icon={ShieldCheck}>
              Authorized by patient
            </Badge>
          </div>
          <KeyValue
            columns={3}
            items={[
              ["Age", age !== null ? `${age} (born ${shortDate(`${patient.dateOfBirth}T12:00:00`)})` : ""],
              ["Conditions", patient.conditions],
              ["Blood type", patient.bloodType],
              ["Phone", profile.phone],
              ["Emergency contact", patient.emergencyContact],
              ["Email", profile.email],
            ]}
          />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={FileText} label="Files on record" value={status.files} hint={status.state === "marked" ? "A document marks a result" : status.state === "reviewed" ? "Reviewed" : status.state === "saved" ? "Saved" : "None added"} />
        <Stat icon={TriangleAlert} label="Marked results" value={marked} tone={marked ? "apricot" : "brand"} />
        <Stat icon={Watch} label="Outside a saved range" value={outside} hint="Latest wearable readings" tone={outside ? "apricot" : "brand"} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)]">
        <section id="readings" className="grid scroll-mt-28 gap-4">
          <SectionTitle>Device readings</SectionTitle>
          <DeviceReadingList board={devices} />
          <MetricHistory board={devices} />
        </section>
        <RecordReview documents={documents} />
      </div>

      {patient.allergies ? (
        <Callout tone="danger" icon={TriangleAlert} title="Allergies">
          {patient.allergies}
        </Callout>
      ) : null}

      <SummaryCard chart={chart} />

      <nav aria-label="Record sections" className="scrollbar-none sticky top-[4.25rem] z-10 -mx-1 flex gap-2 overflow-x-auto bg-canvas px-1 py-2">
        {SECTIONS.map(([anchor, label]) => (
          <a key={anchor} href={`#${anchor}`} className="flex-none rounded-full border border-line bg-white px-4 py-1.5 text-[0.92rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800">
            {label}
          </a>
        ))}
      </nav>

      <section className="grid gap-4">
        <SectionTitle id="concerns">
          <span className="flex items-center gap-2">
            <HeartPulse className="size-5 text-apricot-700" aria-hidden /> Shared health concerns
          </span>
        </SectionTitle>
        {concerns.length ? (
          concerns.map((concern) => (
            <Card key={concern.id} className="p-5">
              <p className="mb-4 text-[0.9rem] font-semibold text-ink-500">Shared concern · {formatWhen(concern.createdAt)}</p>
              <ConcernReview concern={concern} />
            </Card>
          ))
        ) : (
          <EmptyState icon={HeartPulse} title="No shared concerns">
            The patient decides which concerns to share. Private concerns never appear here.
          </EmptyState>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="grid content-start gap-4">
          <SectionTitle id="medicines">
            <span className="flex items-center gap-2">
              <Pill className="size-5 text-ai-700" aria-hidden /> Medicines
            </span>
          </SectionTitle>
          <MedicationTable medications={chart.medications ?? []} prescriptions={chart.prescriptions ?? []} events={chart.medicationEvents ?? []} canRevise />
        </section>
        <section className="grid content-start gap-4">
          <SectionTitle id="visits">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-5 text-[#1d4ed8]" aria-hidden /> Visits
            </span>
          </SectionTitle>
          <VisitList chart={chart} />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={Activity} title="Timeline" description="Most recent 12 entries" className="scroll-mt-28" />
          <div id="timeline" className="scroll-mt-28 px-6 pt-4 pb-3">
            <TimelineList events={(chart.timeline ?? []).slice(0, 12)} compact />
          </div>
        </Card>
        <Card>
          <CardHeader icon={FileText} title="Documents" />
          <div id="documents" className="scroll-mt-28 grid gap-6 px-6 pt-4 pb-6">
            <DocumentList chart={chart} />
            <RecordDesk patients={[{ patientId: chart.patient.id, fullName: chart.profile.fullName }]} lockedPatientId={chart.patient.id} embedded />
          </div>
        </Card>
      </div>

      <section className="grid gap-4">
        <SectionTitle id="notes">
          <span className="flex items-center gap-2">
            <NotebookPen className="size-5 text-brand-700" aria-hidden /> Clinician notes
          </span>
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <NoteList chart={chart} />
          <Card>
            <CardHeader icon={NotebookPen} title="Add a note" description="The patient will see this on their timeline." />
            <div className="px-6 pt-4 pb-6">
              <ActionForm action={addDoctorNoteAction} submit="Save note" resetOnSuccess>
                <input type="hidden" name="patientId" value={patient.id} />
                <label htmlFor="note" className="sr-only">
                  Note
                </label>
                <textarea id="note" name="body" required rows={5} className="input resize-y" placeholder="Reviewed the ankle photo. Elevate and track swelling; call if it spreads or becomes painful." />
              </ActionForm>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
