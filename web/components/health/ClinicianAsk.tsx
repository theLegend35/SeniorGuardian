"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";

import { FormNotice, SubmitButton } from "@/components/ui/forms";
import { AiBlock, FormattedText } from "@/components/ui/primitives";
import { askClinicianAction, type ClinicianAskState } from "@/lib/actions/clinician";

export function ClinicianAsk({ documentId, suggestions }: { documentId?: string; suggestions: string[] }) {
  const [state, action] = useActionState(askClinicianAction, {} as ClinicianAskState);
  return (
    <form action={action} className="card grid gap-4 p-6">
      {documentId ? <input type="hidden" name="documentId" value={documentId} /> : null}
      <div>
        <p className="flex items-center gap-2 text-[0.78rem] font-bold tracking-[0.14em] text-ai-700 uppercase">
          <Sparkles className="size-4" aria-hidden /> Ask
        </p>
        <h2 className="mt-2 font-serif text-[1.7rem] leading-tight text-ink-950">Ask about the records you can see</h2>
        <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-600">Answers stay inside files, medicines, and device numbers from people who authorized you. A dose is quoted from the saved text. Nothing here is a diagnosis.</p>
      </div>
      <label className="grid gap-1.5 text-[0.95rem] font-semibold text-ink-800">
        Question
        <textarea name="question" required rows={3} className="input resize-y font-normal" placeholder="What does the lab mark as high?" />
      </label>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-full border border-line bg-canvas px-3 py-1.5 text-left text-[0.88rem] font-semibold text-ink-700 hover:border-brand-300"
            onClick={(event) => {
              const form = event.currentTarget.form;
              const field = form?.elements.namedItem("question");
              if (!form || !(field instanceof HTMLTextAreaElement)) return;
              field.value = suggestion;
              form.requestSubmit();
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <SubmitButton className="w-fit">Ask</SubmitButton>
      {state.error ? <FormNotice state={state} /> : null}
      {state.answer ? (
        <AiBlock label="From the saved record" meta="Not a diagnosis">
          <FormattedText text={state.answer} />
        </AiBlock>
      ) : null}
    </form>
  );
}
