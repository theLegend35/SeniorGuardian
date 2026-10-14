import Link from "next/link";
import { Activity, NotebookPen } from "lucide-react";

import { SpeechButton } from "@/components/accessibility/SpeechButton";
import { TimelineList, patientEventHref } from "@/components/health/records";
import { ActionForm } from "@/components/ui/forms";
import { Card, CardHeader, EmptyState, PageHeader, cx } from "@/components/ui/primitives";
import { addPatientNoteAction } from "@/lib/actions/health";
import { requireRole } from "@/lib/auth/session";
import { getStore } from "@/lib/data/index";
import type { TimelineKind } from "@/types/domain";

export const metadata = { title: "Timeline" };

const FILTERS: Array<{ key: string; label: string; kinds: TimelineKind[] | null }> = [
  { key: "all", label: "Everything", kinds: null },
  { key: "medicines", label: "Medicines", kinds: ["medication_change", "medication_activity"] },
  { key: "visits", label: "Visits", kinds: ["appointment"] },
  { key: "concerns", label: "Concerns", kinds: ["concern", "image"] },
  { key: "notes", label: "Notes", kinds: ["doctor_note", "patient_note"] },
  { key: "documents", label: "Documents", kinds: ["document", "ai_summary"] },
];

function monthLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Undated";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "all" } = await searchParams;
  const actor = await requireRole("patient");
  const chart = await (await getStore()).getChart(actor, actor.patientId!);
  const filter = FILTERS.find((item) => item.key === show) ?? FILTERS[0];
  const events = (chart.timeline ?? []).filter((event) => !filter.kinds || filter.kinds.includes(event.kind));
  const groups = new Map<string, typeof events>();
  for (const event of events) {
    const key = monthLabel(event.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return (
    <div className="grid gap-7">
      <PageHeader title="Health timeline" description="Everything that happened, in order — concerns, medicine changes, visits, and notes. Original words are always kept." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-5">
          <nav aria-label="Filter timeline" className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((item) => (
              <Link
                key={item.key}
                href={item.key === "all" ? "/patient/timeline" : `/patient/timeline?show=${item.key}`}
                aria-current={item.key === filter.key ? "page" : undefined}
                className={cx(
                  "flex-none rounded-full px-4 py-2 text-[0.95rem] font-semibold transition-colors",
                  item.key === filter.key ? "bg-ink-950 text-white" : "border border-line bg-white text-ink-700 hover:border-line-strong",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {groups.size ? (
            [...groups.entries()].map(([month, items]) => (
              <section key={month} className="card px-6 pt-5 pb-3">
                <h2 className="mb-3 text-[0.85rem] font-bold tracking-wide text-ink-500 uppercase">{month}</h2>
                <TimelineList events={items} hrefFor={patientEventHref} />
              </section>
            ))
          ) : (
            <EmptyState icon={Activity} title="Nothing here yet">
              Activity in this category will appear here.
            </EmptyState>
          )}
        </div>

        <aside className="grid content-start gap-5">
          <Card className="xl:sticky xl:top-24">
            <CardHeader icon={NotebookPen} title="Add a note" description="How you're feeling, a symptom, or something to remember." />
            <div className="px-6 pt-4 pb-6">
              <ActionForm action={addPatientNoteAction} submit="Save note" resetOnSuccess full>
                <label htmlFor="note-body" className="sr-only">
                  Note
                </label>
                <textarea id="note-body" name="body" required rows={4} className="input resize-y" placeholder="Slept well, knee a little stiff this morning…" />
                <SpeechButton targetId="note-body" label="Speak a note" />
              </ActionForm>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
