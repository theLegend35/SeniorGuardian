import Link from "next/link";
import { Clock, FileText, Sparkles, Stethoscope } from "lucide-react";

import { PrescriptionEditor } from "@/components/health/PrescriptionEditor";
import { AppointmentRow, fileUrl } from "@/components/health/records";
import { AiBlock, Badge, EmptyState, FormattedText, SourceBlock, cx } from "@/components/ui/primitives";
import type { PatientChart } from "@/lib/data/types";
import { appWallTime, formatTime, formatWhen, shortDate } from "@/lib/time";
import type { Medication, MedicationEvent, Prescription } from "@/types/domain";

function adherence(med: Medication, events: MedicationEvent[]): { taken: number; expected: number } | null {
  if (!med.times.length) return null;
  const since = Date.now() - 7 * 86400000;
  const start = appWallTime(`${med.startDate}T00:00`).getTime();
  const days = Math.max(0, Math.min(7, Math.floor((Date.now() - Math.max(since, Number.isNaN(start) ? since : start)) / 86400000)));
  const expected = days * med.times.length;
  if (!expected) return null;
  const taken = events.filter((event) => event.medicationId === med.id && event.kind === "taken" && event.scheduledFor && appWallTime(event.scheduledFor).getTime() >= since).length;
  return { taken: Math.min(taken, expected), expected };
}

export function MedicationTable({
  medications,
  prescriptions,
  events,
  canRevise = false,
}: {
  medications: Medication[];
  prescriptions: Prescription[];
  events: MedicationEvent[];
  canRevise?: boolean;
}) {
  const active = medications.filter((med) => med.status === "active");
  if (!active.length) return <EmptyState title="No active medicines saved" />;
  return (
    <ul className="grid gap-3">
      {active.map((med) => {
        const rx = prescriptions.find((item) => item.id === med.prescriptionId);
        const stats = adherence(med, events);
        const percent = stats ? Math.round((stats.taken / stats.expected) * 100) : null;
        return (
          <li key={med.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p translate="no" className="text-[1.05rem] font-bold text-ink-950">{med.name}</p>
                <p className="text-[0.9rem] text-ink-500">
                  {med.frequency}
                  {med.prescribingProvider ? ` · ${med.prescribingProvider}` : ""}
                  {med.startDate ? ` · since ${shortDate(`${med.startDate}T12:00:00`)}` : ""}
                </p>
              </div>
              {percent !== null ? (
                <Badge tone={percent >= 80 ? "success" : percent >= 50 ? "warning" : "danger"}>
                  {stats!.taken}/{stats!.expected} doses logged · 7 days
                </Badge>
              ) : null}
            </div>
            <SourceBlock label="Prescription text" className="mt-3">
              {rx?.sourceText || med.instructions}
            </SourceBlock>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.88rem] text-ink-500">
              <Clock className="size-3.5" aria-hidden /> Reminders: {med.times.map(formatTime).join(", ") || "none"}
            </p>
            {canRevise ? (
              <details className="mt-3 rounded-xl border border-line bg-canvas/50 px-4 py-3">
                <summary className="cursor-pointer text-[0.92rem] font-semibold text-brand-800">Change this prescription</summary>
                <div className="mt-4">
                  <PrescriptionEditor medication={{ id: med.id, name: med.name, instructions: rx?.sourceText || med.instructions, frequency: med.frequency, times: med.times }} />
                </div>
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function VisitList({ chart, hrefBase }: { chart: PatientChart; hrefBase?: string }) {
  const visits = (chart.appointments ?? []).filter((item) => item.status !== "archived").sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  if (!visits.length) return <EmptyState title="No visits saved" />;
  return (
    <ul className="grid gap-2">
      {visits.map((visit) => (
        <li key={visit.id} className="rounded-2xl border border-line">
          <AppointmentRow appointment={visit} href={hrefBase ? `${hrefBase}/${visit.id}` : undefined} />
          {visit.questions.length ? (
            <div className="border-t border-line px-4 py-3">
              <p className="text-[0.8rem] font-bold tracking-wide text-ink-500 uppercase">Patient&apos;s questions</p>
              <ul className="mt-1.5 grid gap-1 text-[0.95rem] text-ink-800">
                {visit.questions.map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DocumentList({ chart }: { chart: PatientChart }) {
  const docs = [...(chart.documents ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!docs.length) return <EmptyState icon={FileText} title="No documents saved" />;
  return (
    <ul className="grid gap-3">
      {docs.map((doc) => (
        <li key={doc.id} className="rounded-2xl border border-line">
          <div className="flex items-center gap-3 px-4 pt-3">
            <FileText className="size-5 flex-none text-ink-500" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink-950">{doc.title}</span>
              <span className="block text-[0.86rem] text-ink-500">{shortDate(doc.createdAt)}</span>
            </span>
            <Link href={`/doctor/records/${doc.id}`} className="inline-flex items-center gap-1 text-[0.88rem] font-semibold text-brand-700 hover:underline">
              Open
            </Link>
            <Link href={`/doctor/assistant?document=${doc.id}`} className="inline-flex items-center gap-1 text-[0.88rem] font-semibold text-brand-700 hover:underline">
              <Sparkles className="size-3.5" aria-hidden /> Ask assistant
            </Link>
          </div>
          <details className="group">
            <summary className="cursor-pointer px-4 py-3 text-[0.88rem] font-semibold text-brand-700">
              <span className="group-open:hidden">Show the original</span>
              <span className="hidden group-open:inline">Hide the original</span>
            </summary>
            <div className="grid gap-3 border-t border-line px-4 py-4">
              {doc.sourceText ? <SourceBlock label="Original document">{doc.sourceText}</SourceBlock> : <p className="text-ink-500">No text was extracted.</p>}
              {doc.aiExplanation ? (
                <AiBlock label="Review of marked results" meta="Not a diagnosis">
                  <FormattedText text={doc.aiExplanation} />
                </AiBlock>
              ) : null}
              {doc.fileId ? (
                <a href={fileUrl(doc.fileId)} target="_blank" rel="noreferrer" className="w-fit font-semibold text-brand-700 underline-offset-4 hover:underline">
                  Open the original file
                </a>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function NoteList({ chart }: { chart: PatientChart }) {
  const notes = chart.notes ?? [];
  if (!notes.length) return <EmptyState icon={Stethoscope} title="No clinician notes yet" />;
  return (
    <ul className="grid gap-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-2xl border border-line bg-brand-50/40 px-4 py-3.5">
          <p className="flex flex-wrap items-center justify-between gap-2 text-[0.88rem]">
            <span className="font-bold text-ink-900">{note.authorName}</span>
            <span className="text-ink-500">{formatWhen(note.createdAt)}</span>
          </p>
          <div className={cx("mt-1.5 text-ink-800")}>
            <FormattedText text={note.body} />
          </div>
        </li>
      ))}
    </ul>
  );
}
