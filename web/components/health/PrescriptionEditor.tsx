"use client";

import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";

import { ActionForm } from "@/components/ui/forms";
import { Field, TextArea, buttonClass, cx } from "@/components/ui/primitives";
import { revisePrescriptionAction } from "@/lib/actions/health";
import { formatTime } from "@/lib/time";

export function PrescriptionEditor({
  medication,
}: {
  medication: { id: string; name: string; instructions: string; frequency: string; times: string[] };
}) {
  const [times, setTimes] = useState<string[]>(medication.times.length ? medication.times : [""]);

  return (
    <ActionForm action={revisePrescriptionAction} submit="Save prescription" pending="Saving…">
      <input type="hidden" name="id" value={medication.id} />
      <Field label="Medicine name and strength" name="name" required defaultValue={medication.name} />
      <TextArea
        label="Prescription instructions"
        name="instructions"
        required
        rows={3}
        defaultValue={medication.instructions}
        hint="This becomes the saved wording. The previous text stays on the timeline. The assistant does not write this change."
      />
      <Field label="How often" name="frequency" required defaultValue={medication.frequency} placeholder="Once a day, morning" />
      <fieldset className="rounded-2xl border border-line bg-white p-4">
        <legend className="px-1 text-[0.95rem] font-semibold text-ink-900">Reminder times</legend>
        <p className="text-[0.88rem] text-ink-500">These must fit the wording above. A once-a-day label cannot have two reminder times.</p>
        <ul className="mt-3 grid gap-2">
          {times.map((time, index) => (
            <li key={index} className="flex items-center gap-2">
              <Clock className="size-4 flex-none text-ink-400" aria-hidden />
              <label className="sr-only" htmlFor={`rx-time-${medication.id}-${index}`}>
                Reminder time {index + 1}
              </label>
              <input
                id={`rx-time-${medication.id}-${index}`}
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
        <button type="button" onClick={() => setTimes((current) => [...current, ""])} className={cx(buttonClass("ghost", "sm"), "mt-3")}>
          <Plus className="size-4" aria-hidden /> Add a time
        </button>
      </fieldset>
    </ActionForm>
  );
}
