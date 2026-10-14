"use client";

import { useEffect, useState } from "react";
import { Camera, Lock, Users, X } from "lucide-react";

import { SpeechButton } from "@/components/accessibility/SpeechButton";
import { ActionForm } from "@/components/ui/forms";
import { Callout, SwitchRow, cx } from "@/components/ui/primitives";
import { saveConcernAction } from "@/lib/actions/health";

export function ConcernForm({ hasDoctor }: { hasDoctor: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [share, setShare] = useState(hasDoctor);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const shown = preview;

  return (
    <ActionForm action={saveConcernAction} submit="Review my concern" pending="Reviewing… this can take a few seconds" size="lg">
      <div>
        <div className="mb-1.5 flex items-end justify-between gap-3">
          <label htmlFor="description" className="text-[1.05rem] font-bold text-ink-950">
            What did you notice?
          </label>
        </div>
        <p className="mb-2 text-[0.92rem] text-ink-500">Where is it, when did it start, and has it changed? Mention pain, fever, or anything that worries you.</p>
        <textarea
          id="description"
          name="description"
          required
          minLength={3}
          rows={5}
          className="input resize-y leading-relaxed"
          placeholder="For example: My left ankle has been swollen since Tuesday. It's a little warm and sore when I walk."
        />
        <div className="mt-2">
          <SpeechButton targetId="description" label="Describe it by voice" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[1.05rem] font-bold text-ink-950">
          Add a photo <span className="font-normal text-ink-400">(optional)</span>
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <label
            className={cx(
              "relative grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-canvas text-ink-500 transition-colors sm:w-64",
              shown ? "border-brand-300" : "border-line-strong hover:border-brand-400 hover:text-brand-700",
            )}
          >
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="Photo preview" className="absolute inset-0 size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-center text-[0.92rem] font-semibold">
                <Camera className="size-8" aria-hidden />
                Take or choose a photo
              </span>
            )}
            <input
              key={inputKey}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
          <div className="flex flex-1 flex-col gap-3 text-[0.92rem] text-ink-600">
            <p>Good light and a steady hand help. Include something for size, like a coin, if you can.</p>
            {shown ? (
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setInputKey((key) => key + 1);
                }}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-danger-700 hover:bg-danger-50"
              >
                <X className="size-4" aria-hidden /> Remove photo
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-canvas/60 px-4 py-2">
        <SwitchRow
          label="Share with my care team"
          description={hasDoctor ? "Only clinicians you've authorized can see it. You can turn this off later." : "You haven't authorized a clinician yet, so nobody can see it."}
          name="share"
          checked={share}
          onChange={(event) => setShare(event.target.checked)}
        />
        <p className="flex items-center gap-1.5 pb-1 text-[0.85rem] font-semibold text-ink-500">
          {share ? <Users className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
          {share ? "Shared with authorized clinicians" : "Private to you"}
        </p>
      </div>

      <Callout tone="danger" title="Is this an emergency?">
        Chest pain, trouble breathing, signs of a stroke, severe bleeding, or fainting — <a href="tel:911" className="font-bold underline">call 911</a> now instead of using this form.
      </Callout>
    </ActionForm>
  );
}
