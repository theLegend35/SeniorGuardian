"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CalendarPlus, Check, MessageCircleHeart, NotebookPen, RotateCcw, SendHorizontal, ShieldAlert, Sparkles, X } from "lucide-react";

import { ReadAloud, SpeechButton } from "@/components/accessibility/SpeechButton";
import { sendOnEnter } from "@/components/chat-key";
import { FormNotice, SubmitButton } from "@/components/ui/forms";
import { Badge, FormattedText, SourceBlock, buttonClass, cx } from "@/components/ui/primitives";
import { askAssistantAction, clearAssistantAction, resolveAssistantAction } from "@/lib/actions/health";
import { formatTime, formatWhen } from "@/lib/time";
import type { AiMessage, ProposedAction } from "@/types/domain";

export type LabelSource = { name: string; text: string; prescriber: string };

function SourceBadge({ source, aiLabel }: { source: AiMessage["source"]; aiLabel: string }) {
  if (source === "safety") return <Badge tone="danger" icon={ShieldAlert}>Safety message</Badge>;
  if (source === "ai") return <Badge tone="ai" icon={Sparkles}>{aiLabel}</Badge>;
  if (source === "rules") return <Badge>From your saved record</Badge>;
  return null;
}

function describeAction(action: ProposedAction) {
  if (action.type === "set_reminder") {
    return {
      icon: Check,
      title: `Add a reminder at ${formatTime(action.time)} for ${action.medicationName}?`,
      detail: `Only a reminder is added. Your prescription stays exactly as written: “${action.preservedInstructions}”`,
    };
  }
  if (action.type === "add_appointment") {
    return {
      icon: CalendarPlus,
      title: `Add an appointment with ${action.provider}?`,
      detail: [formatWhen(action.startsAt), action.specialty, action.location].filter(Boolean).join(" · "),
    };
  }
  return { icon: NotebookPen, title: "Save this note to your timeline?", detail: `“${action.body}”` };
}

function ActionCard({ message }: { message: AiMessage }) {
  const [state, formAction] = useActionState(resolveAssistantAction, {});
  if (!message.proposedAction) return null;
  const info = describeAction(message.proposedAction);
  return (
    <div className="mt-3 rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
      <div className="flex gap-3">
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-200">
          <info.icon className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink-950">{info.title}</p>
          <p className="mt-0.5 text-[0.92rem] text-ink-600">{info.detail}</p>
        </div>
      </div>
      {message.actionStatus === "pending" ? (
        <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2 pl-12">
          <input type="hidden" name="messageId" value={message.id} />
          <SubmitButton size="sm" name="decision" value="confirm" pending="Saving…">
            <Check className="size-4" aria-hidden /> Yes, save it
          </SubmitButton>
          <SubmitButton size="sm" variant="ghost" name="decision" value="dismiss" pending="…">
            <X className="size-4" aria-hidden /> No thanks
          </SubmitButton>
        </form>
      ) : (
        <p className="mt-3 pl-12">
          <Badge tone={message.actionStatus === "confirmed" ? "success" : "neutral"}>{message.actionStatus === "confirmed" ? "Saved" : "Dismissed — nothing changed"}</Badge>
        </p>
      )}
      {state.error ? <div className="mt-3 pl-12"><FormNotice state={state} /></div> : null}
    </div>
  );
}

function AssistantMessage({ message, labels, aiLabel }: { message: AiMessage; labels: Record<string, LabelSource>; aiLabel: string }) {
  const sources = (message.medicationIds ?? []).map((id) => labels[id]).filter(Boolean);
  return (
    <li className="flex gap-3">
      <span className="mt-1 grid size-9 flex-none place-items-center rounded-full bg-brand-700 text-white">
        <MessageCircleHeart className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className={cx("rounded-2xl rounded-tl-md border px-4 py-3.5 shadow-xs", message.source === "safety" ? "border-danger-200 bg-danger-50" : "border-line bg-white")}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <SourceBadge source={message.source} aiLabel={aiLabel} />
          </div>
          <div className="text-[1.02rem] leading-relaxed text-ink-900">
            <FormattedText text={message.content} />
          </div>
          {sources.length ? (
            <div className="mt-4 grid gap-2.5">
              {sources.map((source) => (
                <SourceBlock key={source.name} label={`Original label · ${source.name}`} meta={source.prescriber ? `Prescribed by ${source.prescriber}` : undefined}>
                  {source.text}
                </SourceBlock>
              ))}
            </div>
          ) : null}
          <ActionCard message={message} />
        </div>
        <div className="mt-1 flex items-center gap-1 pl-1">
          <ReadAloud text={message.content} />
        </div>
      </div>
    </li>
  );
}

export function AssistantChat({
  messages,
  labels,
  ai,
  suggestions,
}: {
  messages: AiMessage[];
  labels: Record<string, LabelSource>;
  ai: { configured: boolean; label: string };
  suggestions: string[];
}) {
  const [state, formAction, isPending] = useActionState(askAssistantAction, {});
  const [value, setValue] = useState("");
  const [asked, setAsked] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  const aiLabel = ai.configured ? "AI answer" : "Offline answer";

  useEffect(() => {
    const pane = scroller.current;
    if (!pane) return;
    pane.scrollTo({ top: pane.scrollHeight, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [messages.length, isPending]);

  function ask(question: string) {
    flushSync(() => setValue(question));
    form.current?.requestSubmit();
  }

  return (
    <div className="card flex h-[calc(100dvh-10.5rem)] min-h-[34rem] flex-col overflow-hidden lg:h-[calc(100dvh-9rem)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cx("size-2.5 rounded-full", ai.configured ? "bg-success-600" : "bg-apricot-500")} aria-hidden />
          <p className="text-[0.92rem] font-semibold text-ink-700">{ai.configured ? `Connected to ${ai.label}` : "Offline mode · answers from your saved record"}</p>
        </div>
        {messages.length ? (
          <form
            action={clearAssistantAction}
            onSubmit={(event) => {
              if (!window.confirm("Clear this conversation? Saved medicines, reminders, and notes are not affected.")) event.preventDefault();
            }}
          >
            <button type="submit" className={buttonClass("ghost", "sm")}>
              <RotateCcw className="size-4" aria-hidden /> New conversation
            </button>
          </form>
        ) : null}
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto bg-canvas/50 px-4 py-6 sm:px-6" aria-live="polite">
        {messages.length === 0 && !isPending ? (
          <div className="mx-auto flex max-w-xl flex-col items-center py-6 text-center">
            <span className="grid size-16 place-items-center rounded-3xl bg-brand-700 text-white shadow-raised">
              <MessageCircleHeart className="size-8" aria-hidden />
            </span>
            <h2 className="mt-5 text-[1.6rem] font-extrabold text-ink-950">How can I help today?</h2>
            <p className="mt-2 text-ink-600">
              Ask about your saved medicines, upcoming visits, or what a word on your paperwork means. I&apos;ll always show your original label next to my answer.
            </p>
            <div className="mt-7 grid w-full gap-2.5 sm:grid-cols-2">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={isPending}
                  onClick={() => ask(item)}
                  className="rounded-2xl border border-line bg-white px-4 py-3 text-left font-semibold text-ink-800 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-800"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="mx-auto grid max-w-3xl gap-6">
            {messages.map((message) =>
              message.role === "user" ? (
                <li key={message.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700 px-4 py-3 text-[1.02rem] whitespace-pre-wrap text-white shadow-xs">{message.content}</p>
                </li>
              ) : (
                <AssistantMessage key={message.id} message={message} labels={labels} aiLabel={aiLabel} />
              ),
            )}
            {isPending ? (
              <>
                <li className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-700/85 px-4 py-3 text-[1.02rem] whitespace-pre-wrap text-white">{asked}</p>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-9 flex-none place-items-center rounded-full bg-brand-700 text-white">
                    <MessageCircleHeart className="size-4.5" aria-hidden />
                  </span>
                  <span className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-line bg-white px-4 py-4" role="status" aria-label="The assistant is thinking">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="size-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </span>
                </li>
              </>
            ) : null}
          </ol>
        )}
      </div>

      <div className="border-t border-line bg-white px-4 pt-3 pb-4 sm:px-5">
        {state.error ? (
          <div className="mb-3">
            <FormNotice state={state} />
          </div>
        ) : null}
        {messages.length ? (
          <div className="scrollbar-none -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
            {suggestions.slice(0, 4).map((item) => (
              <button
                key={item}
                type="button"
                disabled={isPending}
                onClick={() => ask(item)}
                className="flex-none rounded-full border border-line bg-canvas px-3.5 py-1.5 text-[0.88rem] font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <form
          ref={form}
          action={formAction}
          onSubmit={(event) => {
            if (!value.trim() || isPending) {
              event.preventDefault();
              return;
            }
            setAsked(value.trim());
            setTimeout(() => setValue(""), 0);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="question" className="sr-only">
            Your question
          </label>
          <textarea
            id="question"
            name="question"
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder="Ask about a medicine, a visit, or a word on your paperwork…"
            className="input max-h-40 min-h-12 flex-1 resize-none py-3 leading-snug"
            maxLength={2000}
          />
          <SpeechButton iconOnly label="Speak your question" onText={(text) => setValue((current) => (current ? `${current.trimEnd()} ${text}` : text))} />
          <button type="submit" disabled={isPending || !value.trim()} className={cx(buttonClass("primary", "icon"), "sm:w-auto sm:px-5")} aria-label="Send">
            <SendHorizontal className="size-5" aria-hidden />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
        <p className="mt-2 text-[0.8rem] text-ink-500">
          Informational only — not medical advice. The assistant never changes a dose. In an emergency, call 911.
        </p>
      </div>
    </div>
  );
}
