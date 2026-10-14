"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CalendarPlus, Check, MessageCircleHeart, NotebookPen, Paperclip, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";

import { ReadAloud, SpeechButton } from "@/components/accessibility/SpeechButton";
import { sendOnEnter } from "@/components/chat-key";
import { askClinicianChatAction, clearClinicianChatAction, resolveClinicianChatAction } from "@/lib/actions/clinician";
import { FormNotice, SubmitButton } from "@/components/ui/forms";
import { Badge, FormattedText, buttonClass, cx } from "@/components/ui/primitives";
import { formatWhen } from "@/lib/time";
import type { AiMessage, ProposedAction } from "@/types/domain";

function describe(action: ProposedAction) {
  if (action.type === "add_appointment") {
    return {
      icon: CalendarPlus,
      title: `Add a visit with ${action.provider}${action.patientName ? ` for ${action.patientName}` : ""}?`,
      detail: [formatWhen(action.startsAt), action.specialty, action.location].filter(Boolean).join(" · "),
    };
  }
  if (action.type === "add_note") {
    return {
      icon: NotebookPen,
      title: `Save this note${action.patientName ? ` on ${action.patientName}'s chart` : ""}?`,
      detail: action.body,
    };
  }
  return null;
}

function ActionCard({ message }: { message: AiMessage }) {
  const [state, formAction] = useActionState(resolveClinicianChatAction, {});
  if (!message.proposedAction) return null;
  const info = describe(message.proposedAction);
  if (!info) return null;
  return (
    <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
      <div className="flex gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-200">
          <info.icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink-950">{info.title}</p>
          <p className="mt-0.5 text-[0.92rem] whitespace-pre-wrap text-ink-600">{info.detail}</p>
        </div>
      </div>
      {message.actionStatus === "pending" ? (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 pl-12">
          <input type="hidden" name="messageId" value={message.id} />
          <SubmitButton size="sm" name="decision" value="confirm" pending="Saving…">
            <Check className="size-4" aria-hidden /> Yes, save it
          </SubmitButton>
          <SubmitButton size="sm" variant="ghost" name="decision" value="dismiss" pending="…">
            <X className="size-4" aria-hidden /> Not now
          </SubmitButton>
        </form>
      ) : (
        <p className="mt-3 pl-12">
          <Badge tone={message.actionStatus === "confirmed" ? "success" : "neutral"}>{message.actionStatus === "confirmed" ? "Saved" : "Dismissed — nothing changed"}</Badge>
        </p>
      )}
      {state.error ? (
        <div className="mt-3 pl-12">
          <FormNotice state={state} />
        </div>
      ) : null}
    </div>
  );
}

export function ClinicianChat({
  messages,
  patients,
  documentId,
  selectedPatientId,
  suggestions,
}: {
  messages: AiMessage[];
  patients: Array<{ patientId: string; fullName: string }>;
  documentId?: string;
  selectedPatientId?: string;
  suggestions: string[];
}) {
  const [state, formAction, pending] = useActionState(askClinicianChatAction, {});
  const [value, setValue] = useState("");
  const [asked, setAsked] = useState("");
  const [fileName, setFileName] = useState("");
  const [patientId, setPatientId] = useState(selectedPatientId ?? patients[0]?.patientId ?? "");
  const form = useRef<HTMLFormElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPatientId) setPatientId(selectedPatientId);
  }, [selectedPatientId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  function ask(question: string) {
    flushSync(() => setValue(question));
    form.current?.requestSubmit();
  }

  return (
    <div className="card flex h-[calc(100dvh-12rem)] min-h-[34rem] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="text-[0.92rem] font-semibold text-ink-700">Clinician assistant · charts you are authorized to see</p>
        {messages.length ? (
          <form action={clearClinicianChatAction} onSubmit={(event) => { if (!window.confirm("Clear this assistant conversation? Saved visits, notes, and files stay.")) event.preventDefault(); }}>
            <button type="submit" className={buttonClass("ghost", "sm")}>
              <RotateCcw className="size-4" aria-hidden /> New conversation
            </button>
          </form>
        ) : null}
      </div>
      <div ref={scroller} className="flex-1 overflow-y-auto bg-canvas/50 px-4 py-6 sm:px-6">
        {messages.length === 0 && !pending ? (
          <div className="mx-auto max-w-xl py-6 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-brand-700 text-white shadow-raised">
              <MessageCircleHeart className="size-8" aria-hidden />
            </span>
            <h2 className="mt-5 text-[1.6rem] font-extrabold text-ink-950">What do you need?</h2>
            <p className="mt-2 text-ink-600">Ask about a patient, a visit, or a saved file. Attach a photo, PDF, or text file, or speak. A visit or note is saved only after you confirm it.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => ask(item)} className="rounded-2xl border border-line bg-white px-4 py-3 text-left font-semibold text-ink-800 hover:border-brand-300">
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="mx-auto grid max-w-3xl gap-5">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700 px-4 py-3 whitespace-pre-wrap text-white">{message.content}</p>
                </li>
              ) : (
                <li key={message.id} className="flex gap-3">
                  <span className="mt-1 grid size-9 flex-none place-items-center rounded-full bg-brand-700 text-white">
                    <Sparkles className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-3.5 shadow-xs">
                    <Badge tone="ai" icon={Sparkles}>{message.source === "ai" ? "AI answer" : "From the saved chart"}</Badge>
                    <div className="mt-2 text-[1.02rem] leading-relaxed text-ink-900">
                      <FormattedText text={message.content} />
                    </div>
                    <ActionCard message={message} />
                    <div className="mt-2">
                      <ReadAloud text={message.content} />
                    </div>
                  </div>
                </li>
              ),
            )}
            {pending ? (
              <li className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700/80 px-4 py-3 whitespace-pre-wrap text-white">{asked || "Sending…"}</p>
              </li>
            ) : null}
          </ol>
        )}
      </div>
      <form
        ref={form}
        action={formAction}
        className="border-t border-line bg-white px-4 py-3 sm:px-5"
        onSubmit={() => {
          setAsked(value.trim() || fileName || "Attached file");
          setTimeout(() => {
            setValue("");
            setFileName("");
            if (file.current) file.current.value = "";
          }, 0);
        }}
      >
        {documentId ? <input type="hidden" name="documentId" value={documentId} /> : null}
        {state.error ? <div className="mb-2"><FormNotice state={state} /></div> : null}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="text-[0.85rem] font-semibold text-ink-600" htmlFor="patientId">Patient</label>
          <select id="patientId" name="patientId" value={patientId} onChange={(event) => setPatientId(event.target.value)} className="input h-10 w-auto min-w-48 py-1">
            {patients.map((patient) => (
              <option key={patient.patientId} value={patient.patientId}>{patient.fullName}</option>
            ))}
          </select>
          <label className={cx(buttonClass("secondary", "sm"), "cursor-pointer")}>
            <Paperclip className="size-4" aria-hidden /> Attach
            <input
              ref={file}
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
              className="sr-only"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
          {fileName ? <span className="text-[0.85rem] text-ink-600">{fileName}</span> : null}
        </div>
        <div className="flex items-end gap-2">
          <label htmlFor="question" className="sr-only">Question</label>
          <textarea
            id="question"
            name="question"
            rows={2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder="Ask about a chart, a visit, or an attached file…"
            className="input max-h-36 min-h-12 flex-1 resize-none py-3"
            maxLength={2000}
          />
          <SpeechButton iconOnly label="Speak" onText={(text) => setValue((current) => (current ? `${current.trimEnd()} ${text}` : text))} />
          <button type="submit" disabled={pending} className={buttonClass("primary", "icon")} aria-label="Send">
            <SendHorizontal className="size-5" aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-[0.8rem] text-ink-500">A visit or note is saved only when you confirm it. This assistant does not change a dose. In an emergency, call 911.</p>
      </form>
    </div>
  );
}
