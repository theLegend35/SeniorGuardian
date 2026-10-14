"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Clock, Plus, ScanText, Trash2, TriangleAlert } from "lucide-react";

import { ActionForm, FormNotice, SubmitButton } from "@/components/ui/forms";
import { Badge, Callout, Field, SwitchRow, TextArea, buttonClass, cx } from "@/components/ui/primitives";
import { readLabelAction, saveMedicationAction } from "@/lib/actions/health";
import type { LabelState } from "@/lib/actions/state";
import { formatTime, localDate } from "@/lib/time";

export type MedicationDraft = {
  name: string;
  instructions: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate: string | null;
  prescribingProvider: string;
  notes: string;
  reminderEnabled: boolean;
};

const PRESETS = [
  ["08:00", "Morning"],
  ["12:00", "Noon"],
  ["18:00", "Evening"],
  ["21:00", "Bedtime"],
] as const;

function LabelScanner({ onRead }: { onRead: (state: LabelState) => void }) {
  const [state, formAction] = useActionState(readLabelAction, {});
  const [preview, setPreview] = useState<string | null>(null);
  const handled = useRef<LabelState | null>(null);

  useEffect(() => {
    if (state.fileId && handled.current !== state) {
      handled.current = state;
      onRead(state);
    }
  }, [state, onRead]);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  return (
    <form action={formAction} className="card overflow-hidden">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <label className="group relative grid aspect-[4/3] w-full flex-none cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong bg-canvas text-ink-500 transition-colors hover:border-brand-400 hover:text-brand-700 sm:w-48">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected label" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-center text-[0.9rem] font-semibold">
              <Camera className="size-7" aria-hidden />
              Take or choose a photo
            </span>
          )}
          <input
            type="file"
            name="label"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[1.15rem] font-bold text-ink-950">
            <ScanText className="size-5 text-ai-600" aria-hidden /> Scan the pharmacy label
          </p>
          <p className="mt-1 text-[0.95rem] text-ink-600">
            The AI copies the words it can read into the form below. It never guesses a dose — you check every field against the bottle before saving.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SubmitButton variant="soft" pending="Reading the label…" size="sm">
              <ScanText className="size-4" aria-hidden /> Read label
            </SubmitButton>
            {state.reading ? <Badge tone={state.reading.confidence === "high" ? "success" : "warning"}>{state.reading.confidence} confidence</Badge> : null}
          </div>
        </div>
      </div>
      {state.error || state.notice ? (
        <div className="border-t border-line px-6 py-3">
          <FormNotice state={state} />
          {state.reading?.notes ? <p className="mt-2 text-[0.9rem] text-ink-600">{state.reading.notes}</p> : null}
        </div>
      ) : null}
    </form>
  );
}

export function MedicationForm({ id, initial, scan }: { id?: string; initial?: MedicationDraft; scan?: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "");
  const [prescriber, setPrescriber] = useState(initial?.prescribingProvider ?? "");
  const [times, setTimes] = useState<string[]>(initial?.times.length ? initial.times : ["08:00"]);
  const [label, setLabel] = useState<{ fileId: string; fileName: string } | null>(null);
  const [fromScan, setFromScan] = useState(false);
  const today = localDate();

  const onRead = (state: LabelState) => {
    if (!state.fileId) return;
    setLabel((current) => (current?.fileId === state.fileId ? current : { fileId: state.fileId!, fileName: state.fileName ?? "label photo" }));
    if (state.reading) {
      const reading = state.reading;
      setName((current) => current || reading.medicationName);
      setInstructions((current) => current || reading.instructions);
      setFrequency((current) => current || reading.frequency);
      setPrescriber((current) => current || reading.prescriber);
      setFromScan(true);
    }
  };

  return (
    <div className="grid gap-6">
      {scan ? <LabelScanner onRead={onRead} /> : null}

      <section className="card p-6">
        {fromScan ? (
          <Callout tone="warning" icon={TriangleAlert} title="Check every field against your label" className="mb-5">
            These fields were filled from the photo. Fix anything that doesn&apos;t match your bottle exactly.
          </Callout>
        ) : null}
        <ActionForm action={saveMedicationAction} submit={id ? "Save changes" : "Save medicine"} pending="Saving…" size="lg">
          {id ? <input type="hidden" name="id" value={id} /> : null}
          {label ? <input type="hidden" name="labelFileId" value={label.fileId} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Medicine name and strength" name="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Lisinopril 10 mg tablet" />
            <Field label="Prescribed by" name="prescribingProvider" value={prescriber} onChange={(event) => setPrescriber(event.target.value)} placeholder="Dr. Marcus Hale" />
          </div>
          <TextArea
            label="Prescription instructions, exactly as written"
            name="instructions"
            required
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            hint="This text is the source of truth. The assistant explains it but never changes it."
          />
          <Field label="How often" name="frequency" required value={frequency} onChange={(event) => setFrequency(event.target.value)} placeholder="Once daily" />

          <fieldset className="rounded-2xl border border-line bg-canvas/60 p-4">
            <legend className="px-1 text-[0.95rem] font-semibold text-ink-900">Reminder times</legend>
            <p className="text-[0.88rem] text-ink-500">Choose when you want to be reminded. This doesn&apos;t change how the medicine is prescribed.</p>
            <ul className="mt-3 grid gap-2">
              {times.map((time, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Clock className="size-4 flex-none text-ink-400" aria-hidden />
                  <label className="sr-only" htmlFor={`time-${index}`}>
                    Reminder time {index + 1}
                  </label>
                  <input
                    id={`time-${index}`}
                    type="time"
                    name="times"
                    value={time}
                    onChange={(event) => setTimes((current) => current.map((item, i) => (i === index ? event.target.value : item)))}
                    className="input max-w-[11rem]"
                  />
                  <span className="text-[0.9rem] text-ink-500">{time ? formatTime(time) : ""}</span>
                  {times.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setTimes((current) => current.filter((_, i) => i !== index))}
                      className={cx(buttonClass("ghost", "sm"), "ml-auto")}
                      aria-label={`Remove reminder time ${index + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.filter(([value]) => !times.includes(value)).map(([value, text]) => (
                <button key={value} type="button" onClick={() => setTimes((current) => [...current, value].sort())} className="rounded-full border border-line-strong bg-white px-3 py-1 text-[0.88rem] font-semibold text-ink-700 hover:border-brand-400 hover:text-brand-800">
                  + {text} {formatTime(value)}
                </button>
              ))}
              {times.length < 6 ? (
                <button type="button" onClick={() => setTimes((current) => [...current, "12:00"])} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.88rem] font-semibold text-brand-700 hover:bg-brand-50">
                  <Plus className="size-3.5" aria-hidden /> Other time
                </button>
              ) : null}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" name="startDate" type="date" required defaultValue={initial?.startDate ?? today} />
            <Field label="End date" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} hint="Leave empty if it's ongoing." />
          </div>
          <TextArea label="My notes" name="notes" rows={2} defaultValue={initial?.notes ?? ""} placeholder="What it's for, side effects to mention, pharmacy phone…" />
          <SwitchRow label="Send me reminders" description="Reminders appear in Alerts at the times above." name="reminderEnabled" defaultChecked={initial?.reminderEnabled ?? true} />
          {label ? <p className="text-[0.88rem] text-ink-500">Label photo attached: {label.fileName}</p> : null}
        </ActionForm>
      </section>
    </div>
  );
}
